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
import { runBattle } from '../_shared/engine/core/battle.ts';

const K_FACTOR = 32;
const REWARD_CREDITS_WIN = 30;
const REWARD_CREDITS_LOSS = 5;

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

    // Forward the caller's own JWT rather than using the service-role key,
    // so auth.uid() inside RLS/resolve_pvp_attack still resolves to the real
    // attacker and every read below stays inside their existing permissions
    // — no RLS or migration changes needed for this function to work.
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

    // Attacker's roster (and its ability selections) are fetched server-side
    // from their own rows, never trusted from the request body — the only
    // thing the client supplies is who to attack.
    const [
      { data: attackerChars, error: attackerCharsError },
      { data: attackerAbilityProgress },
      { data: attackerProgress },
      { data: defenseRow },
      { data: defenderProgress },
    ] = await Promise.all([
      supabase.from('player_characters').select('character_id, xp, rarity').eq('user_id', user.id),
      supabase.from('character_ability_progress').select('character_id, selected_ability_id').eq('user_id', user.id),
      supabase.from('player_progress').select('pvp_rating').eq('user_id', user.id).maybeSingle(),
      supabase.from('pvp_defense_teams').select('characters').eq('user_id', defenderId).maybeSingle(),
      supabase.from('player_progress').select('pvp_rating').eq('user_id', defenderId).maybeSingle(),
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
    const attackerEntries: OwnedCharacterEntry[] = (attackerChars ?? []).map((c) => ({
      id: c.character_id,
      xp: c.xp,
      rarity: c.rarity,
      selectedAbilityId: attackerSelectedAbilityByCharacterId[c.character_id],
    }));
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
    const defenderEntries: OwnedCharacterEntry[] = defenderSnapshot.map((c) => ({
      id: c.characterId,
      xp: c.xp,
      rarity: c.rarity as OwnedCharacterEntry['rarity'],
      selectedAbilityId: c.selectedAbilityId,
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

    const { error: rpcError } = await supabase.rpc('resolve_pvp_attack', {
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
