// Starts a turn-based PvP battle. Runs server-side for the same reason pvp-attack (now removed)
// did: PvP results affect a real opponent's rating, so a motivated player can't be trusted to
// compute (or even just report) the fight themselves. Unlike the old one-shot pvp-attack, this
// battle is genuinely interactive — the attacker chooses each of their units' actions turn by
// turn (see pvp-turn-act) — so the server can't resolve the whole thing in one call. Instead this
// function builds both rosters, creates the battle (src/engine/turn/roundLoop.ts's
// createTurnBattle, mirrored into _shared/engine by scripts/sync-pvp-engine.mjs), and parks its
// state in `pvp_turn_battles` — a row only the service-role key (this function) ever reads or
// writes; the client only ever holds the row's id.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3';
import { corsHeaders } from '../_shared/cors.ts';
import { commitBattleOutcome } from '../_shared/pvpTurnCommit.ts';
import { bonusesFromModules, equippedByCharacter } from '../_shared/data/moduleBonuses.ts';
import { loadTurnCombatantsByIds } from '../_shared/engine/turn/loader.ts';
import { createTurnBattle, pendingAllyUnit } from '../_shared/engine/turn/roundLoop.ts';
import { Rng } from '../_shared/engine/core/rng.ts';
import type { Row } from '../_shared/engine/turn/types.ts';
import type { TurnOwnedCharacterEntry } from '../_shared/engine/turn/schema.ts';

/** docs/gdd.md section 5: "times de até 5". Mirrors src/hooks/usePlayerTeams.ts's MAX_TEAM_MEMBERS. */
const MAX_TEAM_MEMBERS = 5;
/** Abandoned battles (started, never finished) older than this are swept on the next pvp-turn-start — no cron needed. */
const ABANDONED_BATTLE_MAX_AGE_MS = 60 * 60 * 1000;

interface StartRequestBody {
  defenderId?: string;
}

function formationFor(characterId: string, formationMap: Record<string, unknown>): Row {
  const value = formationMap[characterId];
  return value === 'front' || value === 'back' ? value : 'front';
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

    // Same split as the old pvp-attack: the caller's own JWT for every read (so RLS stays
    // exactly what it already is for this user), service-role only for the one privileged write
    // (the defender's own runes/formation, which their RLS wouldn't otherwise let this caller see).
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

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

    const body = (await req.json()) as StartRequestBody;
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

    // Abandoned-battle cleanup — best-effort, never blocks starting the new one.
    admin
      .from('pvp_turn_battles')
      .delete()
      .eq('attacker_id', user.id)
      .lt('created_at', new Date(Date.now() - ABANDONED_BATTLE_MAX_AGE_MS).toISOString())
      .then(() => {});

    const [
      { data: attackerChars, error: attackerCharsError },
      { data: attackerProgress },
      { data: attackerOwnDefense },
      { data: attackerVersionRows },
      { data: attackerModules },
      { data: defenseRow },
      { data: defenderProgress },
      { data: defenderModules },
      { data: defenderVersionRows },
    ] = await Promise.all([
      supabase.from('player_characters').select('character_id, xp, rarity').eq('user_id', user.id),
      supabase.from('player_progress').select('pvp_rating, pvp_team_slot').eq('user_id', user.id).maybeSingle(),
      // The attacker's own saved PvP row — its `formation` is reused as the attacker's live
      // formation too (one "how I arrange my PvP team" setting, used whichever role they're in).
      supabase.from('pvp_defense_teams').select('formation').eq('user_id', user.id).maybeSingle(),
      supabase.from('character_ability_progress').select('character_id, character_version').eq('user_id', user.id),
      supabase.from('player_modules').select('module_id, rarity, equipped_on').eq('user_id', user.id).not('equipped_on', 'is', null),
      supabase.from('pvp_defense_teams').select('characters, formation').eq('user_id', defenderId).maybeSingle(),
      supabase.from('player_progress').select('pvp_rating').eq('user_id', defenderId).maybeSingle(),
      admin.from('player_modules').select('module_id, rarity, equipped_on').eq('user_id', defenderId).not('equipped_on', 'is', null),
      admin.from('character_ability_progress').select('character_id, character_version').eq('user_id', defenderId),
    ]);

    if (attackerCharsError) {
      return new Response(JSON.stringify({ error: attackerCharsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const attackerTeamSlot = attackerProgress?.pvp_team_slot ?? 1;
    const { data: attackerTeamRow } = await supabase
      .from('player_teams')
      .select('characters')
      .eq('user_id', user.id)
      .eq('slot', attackerTeamSlot)
      .maybeSingle();

    const ownedById = new Map((attackerChars ?? []).map((c) => [c.character_id, c]));
    const teamIds = (attackerTeamRow?.characters as unknown as string[] | null) ?? [];
    const selectedIds = [...new Set(teamIds.filter((id) => ownedById.has(id)))];
    const attackerIds = (selectedIds.length > 0 ? selectedIds : [...new Set((attackerChars ?? []).map((c) => c.character_id))]).slice(
      0,
      MAX_TEAM_MEMBERS,
    );
    if (attackerIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No characters to attack with' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const attackerVersionByCharacterId = Object.fromEntries((attackerVersionRows ?? []).map((p) => [p.character_id, p.character_version as number]));
    const attackerModulesByCharacter = equippedByCharacter(attackerModules ?? []);
    const attackerFormation = (attackerOwnDefense?.formation as unknown as Record<string, unknown>) ?? {};

    const attackerEntries: TurnOwnedCharacterEntry[] = attackerIds.map((id) => {
      const c = ownedById.get(id)!;
      return {
        id: c.character_id,
        xp: c.xp,
        rarity: c.rarity,
        version: attackerVersionByCharacterId[c.character_id],
        modules: bonusesFromModules(attackerModulesByCharacter[c.character_id] ?? []),
        row: formationFor(c.character_id, attackerFormation),
      };
    });

    const defenderSnapshot =
      (defenseRow?.characters as unknown as { characterId: string; xp: number; rarity?: string }[] | null) ?? [];
    if (defenderSnapshot.length === 0) {
      return new Response(JSON.stringify({ error: 'Defender has no defense team set' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const uniqueDefenders = [...new Map(defenderSnapshot.map((c) => [c.characterId, c])).values()].slice(0, MAX_TEAM_MEMBERS);
    const defenderVersionByCharacterId = Object.fromEntries((defenderVersionRows ?? []).map((p) => [p.character_id, p.character_version as number]));
    const defenderModulesByCharacter = equippedByCharacter(defenderModules ?? []);
    const defenderFormation = (defenseRow?.formation as unknown as Record<string, unknown>) ?? {};

    const defenderEntries: TurnOwnedCharacterEntry[] = uniqueDefenders.map((c) => ({
      id: c.characterId,
      xp: c.xp,
      rarity: c.rarity as TurnOwnedCharacterEntry['rarity'],
      version: defenderVersionByCharacterId[c.characterId],
      modules: bonusesFromModules(defenderModulesByCharacter[c.characterId] ?? []),
      row: formationFor(c.characterId, defenderFormation),
    }));

    const attackerRating = attackerProgress?.pvp_rating ?? 1000;
    const defenderRating = defenderProgress?.pvp_rating ?? 1000;

    const allies = loadTurnCombatantsByIds(attackerEntries);
    const enemies = loadTurnCombatantsByIds(defenderEntries);
    const seed = Date.now() >>> 0;
    const state = createTurnBattle(allies, enemies, seed);

    // Battle-opening passives (battleStart) could in principle decide the fight before any
    // player action — no authored kit does today, but handle it rather than parking a
    // finished battle that pvp-turn-act would never be called to close out.
    if (state.winner !== null) {
      const outcome = await commitBattleOutcome(admin, {
        attackerId: user.id,
        defenderId,
        won: state.winner === 'allies',
        attackerRating,
        defenderRating,
        log: state.log,
        attackerCharacterIds: attackerIds,
        defenderCharacterIds: uniqueDefenders.map((c) => c.characterId),
      });
      return new Response(
        JSON.stringify({
          battleId: null,
          allies: state.allies,
          enemies: state.enemies,
          round: state.round,
          phase: state.phase,
          log: state.log,
          finished: true,
          winner: state.winner,
          ...outcome,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: row, error: insertError } = await admin
      .from('pvp_turn_battles')
      .insert({
        attacker_id: user.id,
        defender_id: defenderId,
        state: {
          allies: state.allies,
          enemies: state.enemies,
          round: state.round,
          phase: state.phase,
          log: state.log,
          winner: state.winner,
          rngState: (state.rng as Rng).getState(),
          attackerRatingAtStart: attackerRating,
          defenderRatingAtStart: defenderRating,
        },
      })
      .select('id')
      .single();
    if (insertError || !row) {
      return new Response(JSON.stringify({ error: insertError?.message ?? 'Failed to start battle' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        battleId: row.id,
        allies: state.allies,
        enemies: state.enemies,
        round: state.round,
        phase: state.phase,
        pendingAllyUnitId: pendingAllyUnit(state)?.id ?? null,
        log: state.log,
        finished: state.winner !== null,
        winner: state.winner,
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
