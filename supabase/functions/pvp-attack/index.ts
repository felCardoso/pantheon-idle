// PvP attack resolution, run server-side so a motivated player can't tamper
// with client-side battle computation to inflate their own rating at another
// real player's expense (docs/gdd.md section 6: PvP results affect a real
// opponent's ranking). Runs the exact same deterministic engine as PvE, just
// duplicated into _shared/engine (Deno Edge Functions deploy as a
// self-contained tree and can't import from src/ at deploy time — see that
// directory's files for the line-by-line origin of each copy).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3';
import { corsHeaders } from '../_shared/cors.ts';
import { loadCharactersByIds, type OwnedCharacterEntry } from '../_shared/engine/core/loader.ts';
import { bonusesFromModules, equippedByCharacter } from '../_shared/data/moduleBonuses.ts';
import { runBattle } from '../_shared/engine/core/battle.ts';

const K_FACTOR = 32;
/** docs/gdd.md section 5: "times de até 5". Mirrors src/hooks/usePlayerTeams.ts's MAX_TEAM_MEMBERS. */
const MAX_TEAM_MEMBERS = 5;
const REWARD_CREDITS_WIN = 30;
const REWARD_CREDITS_LOSS = 5;
/**
 * XP the winning side's fielded characters earn from a PvP battle.
 *
 * PvP paid no XP at all, so a defense team that differed from the PvE team never levelled —
 * and once PvE stopped levelling the whole collection, it never levelled at all. Both sides are
 * paid here: the attacker's PvP squad and, when the attack is repelled, the defenders. Only on a
 * win, matching PvE, where a loss pays credits but no XP.
 */
const PVP_XP_WIN = 25;

function expectedScore(a: number, b: number): number {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

interface AttackRequestBody {
  defenderId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Reads forward the caller's own JWT rather than using the service-role key,
    // so auth.uid() inside RLS still resolves to the real attacker and every
    // read below stays inside their existing permissions. The single privileged
    // write (resolve_pvp_attack) uses a separate service-role client further
    // down — see the comment there for why.
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as AttackRequestBody;
    const defenderId = body.defenderId;
    if (!defenderId || typeof defenderId !== 'string') {
      return new Response(JSON.stringify({ error: 'defenderId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (defenderId === user.id) {
      return new Response(JSON.stringify({ error: 'Cannot attack yourself' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service-role client. Used for exactly two things: reading the defender's equipped modules
    // (player_modules is owner-only under RLS, and the attacker legitimately needs to know what
    // they are fighting) and the privileged write further down — see the comment there. Every
    // other read below goes through the caller's own JWT, so RLS is unchanged.
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Attacker's roster (and its ability selections) are fetched server-side
    // from their own rows, never trusted from the request body — the only
    // thing the client supplies is who to attack.
    const [
      { data: attackerChars, error: attackerCharsError },
      { data: attackerAbilityProgress },
      { data: attackerProgress },
      { data: defenseRow },
      { data: defenderProgress },
      { data: attackerModules },
      { data: defenderModules },
      { data: defenderAbilityProgress },
    ] = await Promise.all([
      supabase.from('player_characters').select('character_id, xp, rarity').eq('user_id', user.id),
      supabase
        .from('character_ability_progress')
        .select('character_id, selected_ability_id, character_version, ability_level, bench_level, passive_level')
        .eq('user_id', user.id),
      supabase.from('player_progress').select('pvp_rating, pvp_team_slot').eq('user_id', user.id).maybeSingle(),
      supabase.from('pvp_defense_teams').select('characters').eq('user_id', defenderId).maybeSingle(),
      supabase.from('player_progress').select('pvp_rating').eq('user_id', defenderId).maybeSingle(),
      // Equipped runes, for both sides. Read live rather than from the defense snapshot: a rune
      // the defender equipped after saving their team should still protect them, and PvE already
      // applies modules (lib/battle-resolve.ts), so leaving them out here would make the same
      // roster fight at two different strengths depending on the mode.
      supabase.from('player_modules').select('module_id, rarity, equipped_on').eq('user_id', user.id).not('equipped_on', 'is', null),
      admin.from('player_modules').select('module_id, rarity, equipped_on').eq('user_id', defenderId).not('equipped_on', 'is', null),
      // Versions likewise: the defense snapshot predates the version axis and carries no version
      // field, so the defender's live progress rows are the only source. character_ability_progress
      // is owner-only under RLS, hence the admin client.
      admin.from('character_ability_progress').select('character_id, character_version, ability_level, bench_level, passive_level').eq('user_id', defenderId),
    ]);

    if (attackerCharsError) {
      return new Response(JSON.stringify({ error: attackerCharsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const attackerSelectedAbilityByCharacterId = Object.fromEntries(
      (attackerAbilityProgress ?? []).filter((p) => p.selected_ability_id).map((p) => [p.character_id, p.selected_ability_id as string]),
    );
    // Version unlocks the passive at any rarity (PASSIVE_UNLOCK_VERSION), so it has to reach the
    // loader here too or a v2.0 character would fight without the passive they paid for.
    const attackerVersionByCharacterId = Object.fromEntries(
      (attackerAbilityProgress ?? []).map((p) => [p.character_id, p.character_version as number]),
    );
    // Bought ability levels, for both sides — PvE applies them (lib/battle-resolve.ts), so PvP has
    // to as well or the same character fights at two different strengths.
    const levelsOf = (rows: { character_id: string; ability_level: number; bench_level: number; passive_level: number }[] | null) =>
      Object.fromEntries((rows ?? []).map((p) => [p.character_id, { active: p.ability_level, bench: p.bench_level, passive: p.passive_level }]));
    const attackerLevels = levelsOf(attackerAbilityProgress);
    const defenderLevels = levelsOf(defenderAbilityProgress);
    // Attack with the squad the player selected for PvP, not their whole collection.
    // Reading every player_characters row meant someone who owned 16 characters
    // attacked with all 16 against a defense capped at 5 (docs/gdd.md section 5:
    // "times de até 5"), which both broke the format and made the PvP team choice on
    // the Team page meaningless for offense. Fall back to the first few owned only
    // when no team row exists yet, so a brand-new player can still attack.
    const attackerTeamSlot = attackerProgress?.pvp_team_slot ?? 1;
    const { data: attackerTeamRow } = await supabase
      .from('player_teams')
      .select('characters')
      .eq('user_id', user.id)
      .eq('slot', attackerTeamSlot)
      .maybeSingle();

    const ownedById = new Map((attackerChars ?? []).map((c) => [c.character_id, c]));
    // Deduped: a repeated id would build two Combatants sharing an id and count twice toward
    // the mythology synergy bonus, so a single owned character could field as five.
    const teamIds = (attackerTeamRow?.characters as unknown as string[] | null) ?? [];
    const selectedIds = [...new Set(teamIds.filter((id) => ownedById.has(id)))];
    const attackerIds = (selectedIds.length > 0 ? selectedIds : [...new Set((attackerChars ?? []).map((c) => c.character_id))]).slice(
      0,
      MAX_TEAM_MEMBERS,
    );

    const defenderVersionByCharacterId = Object.fromEntries(
      (defenderAbilityProgress ?? []).map((p) => [p.character_id, p.character_version as number]),
    );
    const attackerModulesByCharacter = equippedByCharacter(attackerModules ?? []);
    const defenderModulesByCharacter = equippedByCharacter(defenderModules ?? []);

    const attackerEntries: OwnedCharacterEntry[] = attackerIds.map((id) => {
      const c = ownedById.get(id)!;
      return {
        id: c.character_id,
        xp: c.xp,
        rarity: c.rarity,
        selectedAbilityId: attackerSelectedAbilityByCharacterId[c.character_id],
        version: attackerVersionByCharacterId[c.character_id],
        levels: attackerLevels[c.character_id],
        modules: bonusesFromModules(attackerModulesByCharacter[c.character_id] ?? []),
      };
    });
    if (attackerEntries.length === 0) {
      return new Response(JSON.stringify({ error: 'No characters to attack with' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const defenderSnapshot =
      (defenseRow?.characters as unknown as { characterId: string; xp: number; rarity?: string; selectedAbilityId?: string }[] | null) ?? [];
    if (defenderSnapshot.length === 0) {
      return new Response(JSON.stringify({ error: 'Defender has no defense team set' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Capped and deduped at read time as well as by pvp_defense_teams' own constraint and the
    // save route's guard (migration 0020), since snapshots written before those existed can
    // still be oversized or repeat a character.
    const uniqueDefenders = [...new Map(defenderSnapshot.map((c) => [c.characterId, c])).values()];
    const defenderEntries: OwnedCharacterEntry[] = uniqueDefenders.slice(0, MAX_TEAM_MEMBERS).map((c) => ({
      id: c.characterId,
      xp: c.xp,
      rarity: c.rarity as OwnedCharacterEntry['rarity'],
      selectedAbilityId: c.selectedAbilityId,
      version: defenderVersionByCharacterId[c.characterId],
      levels: defenderLevels[c.characterId],
      modules: bonusesFromModules(defenderModulesByCharacter[c.characterId] ?? []),
    }));

    const attackerRating = attackerProgress?.pvp_rating ?? 1000;
    const defenderRating = defenderProgress?.pvp_rating ?? 1000;

    const attackers = loadCharactersByIds(attackerEntries);
    const defenders = loadCharactersByIds(defenderEntries);
    const result = runBattle(attackers, defenders, { seed: Date.now() >>> 0 });
    const won = result.winner === 'allies';

    const expected = expectedScore(attackerRating, defenderRating);
    const attackerDelta = Math.round(K_FACTOR * ((won ? 1 : 0) - expected));
    const defenderDelta = -attackerDelta;
    const newRating = Math.max(0, attackerRating + attackerDelta);

    // Committing the outcome is the one privileged step: it writes to another
    // player's rating. It goes through the service-role key rather than the
    // caller's JWT so that resolve_pvp_attack can be revoked from `authenticated`
    // entirely (migration 0020) — otherwise any logged-in player could call the
    // RPC directly from the browser and hand themselves whatever rating they
    // liked, which would make computing the battle here pointless.
    const { error: rpcError } = await admin.rpc('resolve_pvp_attack', {
      p_attacker_id: user.id,
      p_defender_id: defenderId,
      p_winner: won ? 'attacker' : 'defender',
      p_log: result.log,
      p_attacker_rating_delta: attackerDelta,
      p_defender_rating_delta: defenderDelta,
    });
    if (rpcError) {
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // XP for whichever side won, written with the service-role client because a repelled attack
    // pays the *defender's* characters — another user's rows, which the caller's JWT can't touch.
    const xpWinnerIds = won ? attackerEntries.map((e) => e.id) : defenderEntries.map((e) => e.id);
    const xpWinnerUserId = won ? user.id : defenderId;
    const xpEarnedByCharacterId: Record<string, number> = {};
    if (xpWinnerIds.length > 0) {
      const { data: winnerRows } = await admin
        .from('player_characters')
        .select('character_id, xp, rarity')
        .eq('user_id', xpWinnerUserId)
        .in('character_id', xpWinnerIds);
      // A defender may have sold or never owned a character still named in their saved snapshot;
      // only rows that actually exist are paid.
      const rows = winnerRows ?? [];
      if (rows.length > 0) {
        await admin.from('player_characters').upsert(
          rows.map((c) => ({ user_id: xpWinnerUserId, character_id: c.character_id, xp: c.xp + PVP_XP_WIN, rarity: c.rarity })),
          { onConflict: 'user_id,character_id' },
        );
        for (const c of rows) xpEarnedByCharacterId[c.character_id] = PVP_XP_WIN;
      }
    }

    return new Response(
      JSON.stringify({
        won,
        ratingDelta: attackerDelta,
        newRating,
        rewardCredits: won ? REWARD_CREDITS_WIN : REWARD_CREDITS_LOSS,
        // The fight itself, so the client can actually show it instead of just the outcome —
        // same log/combatant shapes useBattleReplay already knows how to step through for PvE.
        // Both rosters are small (<=5 a side), so this stays well within response-size budget.
        log: result.log,
        attackers,
        defenders,
        // Only populated when the caller won — a repelled attack pays the defender, whose roster
        // this client has no business updating.
        xpEarnedByCharacterId: won ? xpEarnedByCharacterId : {},
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
