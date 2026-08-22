import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { TurnAction, TurnBattleLogEntry, TurnCombatant, TurnPhase } from '../engine';
import type { PvpOpponent } from './usePvp';

/**
 * Drives one turn-based PvP battle against the two Edge Functions (supabase/functions/
 * pvp-turn-start, pvp-turn-act) — a per-round round trip, not a one-shot call: the server is
 * always the authority (RNG and action legality run there, never in this hook), so every action
 * the player picks is only ever a *request*, confirmed or rejected by the next response. See
 * src/engine/turn/roundLoop.ts's applyPlayerAction for what "legal" means server-side.
 *
 * The server auto-plays the entire enemy phase (and any of the player's own stunned/charging
 * rounds) inside a single pvp-turn-act call, so `act` only needs to be called once per actual
 * player decision — the response already reflects wherever the battle landed after that.
 */

export interface TurnBattleOutcome {
  won: boolean;
  ratingDelta: number;
  newRating: number;
  rewardCredits: number;
  xpEarnedByCharacterId: Record<string, number>;
}

interface TurnBattleResponse {
  battleId: string | null;
  allies: TurnCombatant[];
  enemies: TurnCombatant[];
  round: number;
  phase: TurnPhase;
  pendingAllyUnitId: string | null;
  log: TurnBattleLogEntry[];
  finished: boolean;
  winner: 'allies' | 'enemies' | 'draw' | null;
  ratingDelta?: number;
  newRating?: number;
  rewardCredits?: number;
  xpEarnedByCharacterId?: Record<string, number>;
  won?: boolean;
}

export interface UsePvpTurnBattleResult {
  allies: TurnCombatant[];
  enemies: TurnCombatant[];
  round: number;
  phase: TurnPhase | null;
  pendingAllyUnitId: string | null;
  log: TurnBattleLogEntry[];
  finished: boolean;
  winner: 'allies' | 'enemies' | 'draw' | null;
  outcome: TurnBattleOutcome | null;
  /** True while the initial pvp-turn-start call or an in-flight act() is pending. */
  loading: boolean;
  error: string | null;
  startBattle: (opponent: PvpOpponent) => Promise<boolean>;
  act: (unitId: string, action: TurnAction) => Promise<void>;
}

/**
 * `supabase.functions.invoke` surfaces a missing function as a generic network/CORS error,
 * because a 404 from the functions gateway carries no CORS headers for the browser to accept.
 * Nothing in the response distinguishes it, so match on the shape of the failure and name the
 * likely cause — same diagnostic the old pvp-attack call used.
 */
function invokeErrorMessage(error: { message?: string } | null, fnName: string): string {
  const raw = error?.message ?? '';
  if (/failed to (fetch|send)|networkerror|load failed/i.test(raw)) {
    return `Não foi possível falar com o servidor de PvP. A function \`${fnName}\` pode não estar publicada no projeto Supabase (supabase functions deploy ${fnName}).`;
  }
  return raw || 'A batalha falhou.';
}

const EMPTY: TurnCombatant[] = [];
const EMPTY_LOG: TurnBattleLogEntry[] = [];

export function usePvpTurnBattle(): UsePvpTurnBattleResult {
  const [battleId, setBattleId] = useState<string | null>(null);
  const [allies, setAllies] = useState<TurnCombatant[]>(EMPTY);
  const [enemies, setEnemies] = useState<TurnCombatant[]>(EMPTY);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<TurnPhase | null>(null);
  const [pendingAllyUnitId, setPendingAllyUnitId] = useState<string | null>(null);
  const [log, setLog] = useState<TurnBattleLogEntry[]>(EMPTY_LOG);
  const [finished, setFinished] = useState(false);
  const [winner, setWinner] = useState<'allies' | 'enemies' | 'draw' | null>(null);
  const [outcome, setOutcome] = useState<TurnBattleOutcome | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyResponse(data: TurnBattleResponse) {
    setBattleId(data.battleId);
    setAllies(data.allies);
    setEnemies(data.enemies);
    setRound(data.round);
    setPhase(data.phase);
    setPendingAllyUnitId(data.pendingAllyUnitId);
    setLog(data.log);
    setFinished(data.finished);
    setWinner(data.winner);
    if (data.finished && data.won !== undefined) {
      setOutcome({
        won: data.won,
        ratingDelta: data.ratingDelta ?? 0,
        newRating: data.newRating ?? 0,
        rewardCredits: data.rewardCredits ?? 0,
        xpEarnedByCharacterId: data.xpEarnedByCharacterId ?? {},
      });
    }
  }

  const startBattle = useCallback(async (opponent: PvpOpponent): Promise<boolean> => {
    setLoading(true);
    setError(null);
    setOutcome(null);
    const { data, error: invokeError } = await supabase.functions.invoke<TurnBattleResponse>('pvp-turn-start', {
      body: { defenderId: opponent.userId },
    });
    setLoading(false);
    if (invokeError || !data) {
      setError(invokeErrorMessage(invokeError, 'pvp-turn-start'));
      return false;
    }
    applyResponse(data);
    return true;
  }, []);

  const act = useCallback(
    async (unitId: string, action: TurnAction) => {
      if (!battleId) return;
      setLoading(true);
      setError(null);
      const { data, error: invokeError } = await supabase.functions.invoke<TurnBattleResponse>('pvp-turn-act', {
        body: { battleId, unitId, action },
      });
      setLoading(false);
      if (invokeError || !data) {
        setError(invokeErrorMessage(invokeError, 'pvp-turn-act'));
        return;
      }
      applyResponse(data);
    },
    [battleId],
  );

  return { allies, enemies, round, phase, pendingAllyUnitId, log, finished, winner, outcome, loading, error, startBattle, act };
}
