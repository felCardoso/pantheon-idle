// Applies one player action to an in-progress turn-based PvP battle started by pvp-turn-start.
// The server is always the authority here — RNG and action legality never run only on the
// client — which is what lets the client be genuinely interactive (the player reacts to
// server-confirmed state every round) without opening a rating-forgery hole: see
// src/engine/turn/roundLoop.ts's applyPlayerAction, which validates the action itself (right
// unit, right phase, legal target/ability/cooldown) before applying it.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3';
import { corsHeaders } from '../_shared/cors.ts';
import { commitBattleOutcome } from '../_shared/pvpTurnCommit.ts';
import { applyPlayerAction, pendingAllyUnit, type TurnBattleState } from '../_shared/engine/turn/roundLoop.ts';
import { Rng } from '../_shared/engine/core/rng.ts';
import type { TurnAction, TurnCombatant } from '../_shared/engine/turn/types.ts';

interface ActRequestBody {
  battleId?: string;
  unitId?: string;
  action?: TurnAction;
}

interface StoredBattleState {
  allies: TurnCombatant[];
  enemies: TurnCombatant[];
  round: number;
  phase: TurnBattleState['phase'];
  log: TurnBattleState['log'];
  winner: TurnBattleState['winner'];
  rngState: number;
  attackerRatingAtStart: number;
  defenderRatingAtStart: number;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonError('Missing Authorization header', 401);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return jsonError('Invalid session', 401);

    const body = (await req.json()) as ActRequestBody;
    const { battleId, unitId, action } = body;
    if (!battleId || typeof battleId !== 'string') return jsonError('battleId is required', 400);
    if (!unitId || typeof unitId !== 'string') return jsonError('unitId is required', 400);
    if (!action || (action.type !== 'basicAttack' && action.type !== 'ability')) return jsonError('A valid action is required', 400);

    const { data: row, error: fetchError } = await admin.from('pvp_turn_battles').select('*').eq('id', battleId).maybeSingle();
    if (fetchError) return jsonError(fetchError.message, 500);
    if (!row) return jsonError('Battle not found — it may have already finished or timed out', 404);
    // No RLS policy grants a client read on this table (migration 0027) — this check is the only
    // thing standing between a captured battleId and acting on someone else's fight, now that we
    // read it via the service-role key rather than the caller's own JWT.
    if (row.attacker_id !== user.id) return jsonError('This battle does not belong to you', 403);

    const stored = row.state as StoredBattleState;
    const state: TurnBattleState = {
      allies: stored.allies,
      enemies: stored.enemies,
      round: stored.round,
      phase: stored.phase,
      log: stored.log,
      winner: stored.winner,
      rng: Rng.fromState(stored.rngState),
    };

    try {
      applyPlayerAction(state, unitId, action);
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : 'Illegal action', 400);
    }

    if (state.winner !== null) {
      const outcome = await commitBattleOutcome(admin, {
        attackerId: row.attacker_id,
        defenderId: row.defender_id,
        won: state.winner === 'allies',
        attackerRating: stored.attackerRatingAtStart,
        defenderRating: stored.defenderRatingAtStart,
        log: state.log,
        attackerCharacterIds: state.allies.map((c) => c.id),
        defenderCharacterIds: state.enemies.map((c) => c.id),
      });
      await admin.from('pvp_turn_battles').delete().eq('id', battleId);
      return new Response(
        JSON.stringify({
          battleId,
          allies: state.allies,
          enemies: state.enemies,
          round: state.round,
          phase: state.phase,
          pendingAllyUnitId: null,
          log: state.log,
          finished: true,
          winner: state.winner,
          ...outcome,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { error: updateError } = await admin
      .from('pvp_turn_battles')
      .update({
        state: {
          allies: state.allies,
          enemies: state.enemies,
          round: state.round,
          phase: state.phase,
          log: state.log,
          winner: state.winner,
          rngState: (state.rng as Rng).getState(),
          attackerRatingAtStart: stored.attackerRatingAtStart,
          defenderRatingAtStart: stored.defenderRatingAtStart,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', battleId);
    if (updateError) return jsonError(updateError.message, 500);

    return new Response(
      JSON.stringify({
        battleId,
        allies: state.allies,
        enemies: state.enemies,
        round: state.round,
        phase: state.phase,
        pendingAllyUnitId: pendingAllyUnit(state)?.id ?? null,
        log: state.log,
        finished: false,
        winner: null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
});
