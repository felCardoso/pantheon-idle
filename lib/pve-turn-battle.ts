import 'server-only';
import {
  applyPlayerAction,
  createTurnBattle,
  pendingAllyUnit,
  Rng,
  type TurnBattleLogEntry,
  type TurnBattleState,
  type TurnCombatant,
  type TurnPhase,
} from '../src/engine';
import { supabaseAdmin } from './supabase-admin';
import { BattleResolveError, type ResolveBattleRequest, type TurnActRequest } from './battle-request';
import { buildPveBattleSetup, finalizeBattleOutcome, type PveBattleContext, type ResolveBattleResult } from './battle-resolve';

/**
 * Manual PvE: the player controls their own side's actions one at a time instead of the default
 * auto-played battle (lib/battle-resolve.ts's resolveBattleForUser) — same interactive round-trip
 * protocol turn-based PvP already uses (supabase/functions/pvp-turn-start/pvp-turn-act), just
 * running as ordinary Next.js API routes instead of Edge Functions since PvE never needed the
 * Deno runtime PvP's opponent-facing functions do. The in-progress battle parks in
 * `pve_turn_battles` between calls — a row only this server-side code (via supabaseAdmin) ever
 * reads or writes, same reasoning as pvp_turn_battles (migration 0027's doc comment).
 */

/** Abandoned battles (started, never finished) older than this are swept on the next turn-start — no cron needed. */
const ABANDONED_BATTLE_MAX_AGE_MS = 60 * 60 * 1000;

interface StoredPveTurnBattle {
  allies: TurnCombatant[];
  enemies: TurnCombatant[];
  round: number;
  phase: TurnPhase;
  log: TurnBattleLogEntry[];
  winner: 'allies' | 'enemies' | 'draw' | null;
  rngState: number;
  /** Frozen at turn-start — see PveBattleContext's doc comment. */
  context: PveBattleContext;
  seed: number;
}

export type TurnBattleStepResult =
  | {
      battleId: string;
      allies: TurnCombatant[];
      enemies: TurnCombatant[];
      round: number;
      phase: TurnPhase;
      pendingAllyUnitId: string | null;
      log: TurnBattleLogEntry[];
      finished: false;
    }
  | ({ battleId: string | null; finished: true } & ResolveBattleResult);

function stateOf(stored: StoredPveTurnBattle): TurnBattleState {
  return {
    allies: stored.allies,
    enemies: stored.enemies,
    round: stored.round,
    phase: stored.phase,
    log: stored.log,
    winner: stored.winner,
    rng: Rng.fromState(stored.rngState),
  };
}

function storableStateOf(state: TurnBattleState, context: PveBattleContext, seed: number): StoredPveTurnBattle {
  return {
    allies: state.allies,
    enemies: state.enemies,
    round: state.round,
    phase: state.phase,
    log: state.log,
    winner: state.winner,
    rngState: (state.rng as Rng).getState(),
    context,
    seed,
  };
}

/** Starts a manually-controlled PvE battle: builds both sides exactly like the auto path does, then parks the fresh state instead of running it to completion. */
export async function startManualPveBattle(userId: string, request: ResolveBattleRequest): Promise<TurnBattleStepResult> {
  // Best-effort cleanup of a battle the player started and never finished — never blocks starting the new one.
  void supabaseAdmin
    .from('pve_turn_battles')
    .delete()
    .eq('user_id', userId)
    .lt('created_at', new Date(Date.now() - ABANDONED_BATTLE_MAX_AGE_MS).toISOString());

  const setup = await buildPveBattleSetup(userId, request);
  const state = createTurnBattle(setup.allies, setup.enemies, setup.seed);

  // Boot-sequence passives (battleStart) could in principle decide the fight before any player
  // action — no authored kit does today, but handle it rather than parking a finished battle
  // turn-act would never be called to close out.
  if (state.winner !== null) {
    const outcome = await finalizeBattleOutcome(userId, setup.context, setup.seed, state.winner, state.log, state.allies, state.enemies);
    return { battleId: null, finished: true, ...outcome };
  }

  const { data: row, error } = await supabaseAdmin
    .from('pve_turn_battles')
    .insert({ user_id: userId, state: storableStateOf(state, setup.context, setup.seed) })
    .select('id')
    .single();
  if (error || !row) throw new BattleResolveError(error?.message ?? 'Failed to start battle', 500);

  return {
    battleId: row.id,
    allies: state.allies,
    enemies: state.enemies,
    round: state.round,
    phase: state.phase,
    pendingAllyUnitId: pendingAllyUnit(state)?.id ?? null,
    log: state.log,
    finished: false,
  };
}

/** Applies one player action to an in-progress manual PvE battle — validated and resolved the same way turn-based PvP's pvp-turn-act validates and resolves an attacker's action. */
export async function actOnManualPveBattle(userId: string, request: TurnActRequest): Promise<TurnBattleStepResult> {
  const { data: row, error: fetchError } = await supabaseAdmin.from('pve_turn_battles').select('*').eq('id', request.battleId).maybeSingle();
  if (fetchError) throw new BattleResolveError(fetchError.message, 500);
  if (!row) throw new BattleResolveError('Battle not found — it may have already finished or timed out', 404);
  // No RLS policy grants a client read on this table (migration 0028) — this check is the only
  // thing standing between a captured battleId and acting on someone else's battle.
  if (row.user_id !== userId) throw new BattleResolveError('This battle does not belong to you', 403);

  const stored = row.state as StoredPveTurnBattle;
  const state = stateOf(stored);

  try {
    applyPlayerAction(state, request.unitId, request.action);
  } catch (err) {
    throw new BattleResolveError(err instanceof Error ? err.message : 'Illegal action', 400);
  }

  if (state.winner !== null) {
    const outcome = await finalizeBattleOutcome(userId, stored.context, stored.seed, state.winner, state.log, state.allies, state.enemies);
    await supabaseAdmin.from('pve_turn_battles').delete().eq('id', request.battleId);
    return { battleId: request.battleId, finished: true, ...outcome };
  }

  const { error: updateError } = await supabaseAdmin
    .from('pve_turn_battles')
    .update({ state: storableStateOf(state, stored.context, stored.seed), updated_at: new Date().toISOString() })
    .eq('id', request.battleId);
  if (updateError) throw new BattleResolveError(updateError.message, 500);

  return {
    battleId: request.battleId,
    allies: state.allies,
    enemies: state.enemies,
    round: state.round,
    phase: state.phase,
    pendingAllyUnitId: pendingAllyUnit(state)?.id ?? null,
    log: state.log,
    finished: false,
  };
}
