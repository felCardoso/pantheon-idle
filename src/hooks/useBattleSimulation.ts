import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  buildNameToId,
  ESTAGIOS_PER_FASE,
  FASES_PER_WORLD,
  localFaseNumber,
  worldIdForFase,
  worldIndexForFase,
  type BattleLogEntry,
  type Combatant,
  type WorldPosition,
} from '../engine';
import { postApi } from '../lib/apiClient';
import { WORLD_DISPLAY_BY_ID } from '../data/engineDisplay';
import { toBattleUnits } from '../data/battleUnits';
import { useBattleReplay, type AbilityCastEvent, type AttackAnimEvent, type FloatingText } from './useBattleReplay';
import type { BattleUnit, ChatMessage, StageInfo } from '../types';

export type { FloatingText, FloatingTextKind, AbilityCastEvent, AttackAnimEvent, AttackAnimTier } from './useBattleReplay';

/**
 * One already-resolved battle, exactly as app/api/battle/resolve computed it.
 *
 * The client no longer simulates PvE. The server runs the fight, decides the payout and
 * commits it, then hands back the log — so `reward`/`creditsAfter`/`xpAfter` are known the
 * moment the session arrives, and are merely *revealed* once the replay reaches the end.
 * See lib/battle-resolve.ts for why this moved.
 */
interface BattleSession extends WorldPosition {
  seed: number;
  isBoss: boolean;
  allies: Combatant[];
  enemies: Combatant[];
  log: BattleLogEntry[];
  nameToId: Record<string, string>;
  winner: 'allies' | 'enemies' | 'draw';
  reward: Reward;
  creditsAfter: number;
  xpAfter: number;
  /** Where the next battle should be fought, per the server's progression rules. */
  nextPosition: WorldPosition;
}

/** The shape app/api/battle/resolve returns — mirrors ResolveBattleResult in lib/battle-resolve.ts. */
interface ResolveBattleResponse {
  seed: number;
  position: WorldPosition;
  isBoss: boolean;
  winner: 'allies' | 'enemies' | 'draw';
  log: BattleLogEntry[];
  allies: Combatant[];
  enemies: Combatant[];
  reward: Reward;
  credits: number;
  xp: number;
  nextPosition: WorldPosition;
  frontier: WorldPosition;
  recoveryWinsRemaining: number | null;
}

function sessionFrom(response: ResolveBattleResponse): BattleSession {
  return {
    seed: response.seed,
    fase: response.position.fase,
    estagio: response.position.estagio,
    isBoss: response.isBoss,
    allies: response.allies,
    enemies: response.enemies,
    log: response.log,
    nameToId: buildNameToId(response.allies, response.enemies),
    winner: response.winner,
    reward: response.reward,
    creditsAfter: response.credits,
    xpAfter: response.xp,
    nextPosition: response.nextPosition,
  };
}

export interface Reward {
  credits: number;
  xp: number;
}

// Stable identities so useBattleReplay's memo/reset logic doesn't see a "new" empty battle on
// every render during the window before the first server response arrives.
const EMPTY_LOG: BattleLogEntry[] = [];
const EMPTY_COMBATANTS: Combatant[] = [];
const EMPTY_NAME_TO_ID: Record<string, string> = {};

let chatIdCounter = 0;

/** "[1] Jurupari 1-6 / Venceu [+20 C / +15 XP]" — the only line the Log tab's result filters show, once per finished battle. Tagged so "Vitórias"/"Derrota" can be toggled independently, with a draw counted under both (docs request). */
function buildBattleSummary(winner: 'allies' | 'enemies' | 'draw', session: BattleSession, reward: Reward): ChatMessage {
  const won = winner === 'allies';
  const resultLabel = won ? 'Venceu' : winner === 'draw' ? 'Empate' : 'Perdeu';
  const rewardText = won ? `+${reward.credits} C / +${reward.xp} XP` : `+${reward.credits} C`;
  const worldDisplay = WORLD_DISPLAY_BY_ID[worldIdForFase(session.fase)];
  const worldNumber = worldIndexForFase(session.fase) + 1;
  const text = `[${worldNumber}] ${worldDisplay.name.replace(/\.iso$/, '')} ${localFaseNumber(session.fase)}-${session.estagio} / ${resultLabel} [${rewardText}]`;

  chatIdCounter += 1;
  return {
    id: `battle-log-${chatIdCounter}`,
    tab: 'log',
    text,
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    tone: won ? 'success' : winner === 'draw' ? 'system' : 'danger',
    logCategory: won ? 'result-win' : winner === 'draw' ? 'result-draw' : 'result-loss',
  };
}

interface SessionState {
  /** Null until the first battle comes back from the server. */
  session: BattleSession | null;
  /** Bumped on every new session — the replay hook's resetKey, so it knows to restart playback from t=0. */
  battleId: number;
  resultLogFeed: ChatMessage[];
  totalCredits: number;
  totalXp: number;
  /** Credits/XP earned from this specific battle — set once it ends, shown on the winner overlay. */
  lastReward: Reward | null;
  /**
   * The player's real saved progress — the highest position ever reached.
   * Distinct from `session.fase/estagio` (what's currently on screen), and
   * never regresses even when the live position does (e.g. after a retreat,
   * or replaying an earlier estágio via playStage). See progression.ts's
   * resolveProgression for the full transition rules.
   */
  frontier: WorldPosition;
  /** Where the next battle request should be fought — the server decides this from the last result. */
  nextPosition: WorldPosition;
  /** Non-null while grinding back up after a retirar-se-ao-perder retreat — see progression.ts's resolveProgression. */
  recoveryWinsRemaining: number | null;
}

type SessionAction =
  | { type: 'reset'; session: BattleSession; frontier: WorldPosition; recoveryWinsRemaining: number | null }
  | { type: 'battleEnd' }
  | { type: 'adjustCredits'; delta: number }
  | { type: 'setWallet'; credits: number; xp: number };

function buildInitialSession(position: WorldPosition, initialCredits: number, initialXp: number): SessionState {
  return {
    session: null,
    battleId: 0,
    resultLogFeed: [],
    totalCredits: initialCredits,
    totalXp: initialXp,
    lastReward: null,
    frontier: position,
    // Where the next requested battle should be fought — the saved position until the server
    // says otherwise.
    nextPosition: position,
    recoveryWinsRemaining: null,
  };
}

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'reset':
      return {
        session: action.session,
        battleId: state.battleId + 1,
        // The Log tab and the wallet are history across battles, not just this one — carry them forward.
        resultLogFeed: state.resultLogFeed,
        totalCredits: state.totalCredits,
        totalXp: state.totalXp,
        lastReward: null,
        frontier: action.frontier,
        nextPosition: action.session.nextPosition,
        recoveryWinsRemaining: action.recoveryWinsRemaining,
      };
    case 'battleEnd': {
      // The server already committed this payout when it resolved the battle; reaching the end
      // of the replay is only when the player gets to *see* it.
      const session = state.session;
      if (!session) return state;
      return {
        ...state,
        resultLogFeed: [...state.resultLogFeed, buildBattleSummary(session.winner, session, session.reward)],
        totalCredits: session.creditsAfter,
        totalXp: session.xpAfter,
        lastReward: session.reward,
      };
    }
    case 'adjustCredits':
      return { ...state, totalCredits: Math.max(0, state.totalCredits + action.delta) };
    case 'setWallet':
      return { ...state, totalCredits: action.credits, totalXp: action.xp };
  }
}

/**
 * Roster, ability picks and reward bonuses are deliberately absent: the server reads all three
 * from the player's own rows when it resolves a battle, so passing them from here would be both
 * redundant and untrustworthy. See lib/battle-resolve.ts.
 */
export interface UseBattleSimulationOptions {
  /** Milliseconds between revealed log entries while playing. */
  tickMs?: number;
  /** Pause after Vitória!/Derrota before auto-advancing to the next attempt. */
  autoAdvanceDelayMs?: number;
  /** Resume from a saved world position instead of starting at fase 1, estágio 1. */
  initialPosition?: WorldPosition;
  /** Resume from a saved wallet instead of starting at 0. */
  initialCredits?: number;
  initialXp?: number;
}

export interface BattleSimulation {
  allies: BattleUnit[];
  enemies: BattleUnit[];
  stage: StageInfo;
  logFeed: ChatMessage[];
  floaters: FloatingText[];
  /** At most one per side — a concurrent ally + enemy cast is what renders as a clash. */
  activeAbilities: AbilityCastEvent[];
  attackAnims: AttackAnimEvent[];
  /** Créditos/XP earned since `initialCredits`/`initialXp` — the caller is responsible for persisting these. */
  credits: number;
  xp: number;
  /** Créditos/XP earned from the battle that just finished, for the winner overlay — null until one ends. */
  lastReward: Reward | null;
  playing: boolean;
  finished: boolean;
  winner: 'allies' | 'enemies' | 'draw' | null;
  setPlaying: (playing: boolean) => void;
  /** Switches to advance mode ("Avançar") and immediately jumps to the next attempt, per resolveProgression. A no-op if already in advance mode — the auto-advance effect is already driving it. */
  startNewBattle: () => void;
  /** Switches to repeat mode ("Repetir estágio") and immediately retries the same estágio, per resolveProgression's repeat-mode rules. A no-op if already in repeat mode. Every subsequent finished battle keeps retrying until Avançar or the mini-map is used. */
  repeatBattle: () => void;
  /** 'advance' (Avançar) or 'repeat' (Repetir estágio) — the source of truth for which button should be highlighted as primary, and which resolveProgression rules apply on each finish. */
  mode: 'advance' | 'repeat';
  /** "Retirar-se ao perder" — when on, a loss that would otherwise just retry retreats one estágio instead (see progression.ts's resolveProgression). */
  retreatOnLoss: boolean;
  setRetreatOnLoss: (value: boolean) => void;
  /** Non-null while grinding back up after a retreat: how many more consecutive wins (at the current estágio) are needed before an advance is attempted again. */
  recoveryWinsRemaining: number | null;
  /** Spends (negative) or grants (positive) credits outside of battle rewards — the Loja's purchase/sale/claim primitive. Clamped at 0. */
  adjustCredits: (delta: number) => void;
  /** Overwrites credits/xp with server-authoritative values (an /api/** route's response) rather than
   * applying a delta — used to reconcile after an authoritative write instead of computing one locally. */
  setWallet: (credits: number, xp: number) => void;
  /** The player's real saved position (mini-map dots before this are completed) — distinct from `stage` while replaying an earlier estágio or mid-retreat. */
  frontierFase: number;
  frontierEstagio: number;
  /** Jumps to replay a specific estágio within the currently-viewed fase (the mini-map), leaving frontier untouched. */
  playStage: (estagio: number) => void;
  /** Jumps to any already-reached position in any world (the world map), leaving frontier untouched. */
  playPosition: (position: WorldPosition) => void;
  /** Set when a battle request failed (offline, session expired, position not unlocked). */
  error: string | null;
}

export function useBattleSimulation(options: UseBattleSimulationOptions): BattleSimulation {
  const { tickMs = 500, autoAdvanceDelayMs = 1600, initialPosition = { fase: 1, estagio: 1 }, initialCredits = 0, initialXp = 0 } = options;
  const [playing, setPlaying] = useState(true);
  // 'advance' (Avançar) or 'repeat' (Repetir estágio) — which resolveProgression rules apply on
  // each finish. Kept outside the reducer since it's UI-driven mode, not battle state.
  const [mode, setMode] = useState<'advance' | 'repeat'>('advance');
  const [retreatOnLoss, setRetreatOnLoss] = useState(true);
  const [state, dispatch] = useReducer(sessionReducer, undefined, () => buildInitialSession(initialPosition, initialCredits, initialXp));
  const [error, setError] = useState<string | null>(null);

  const onBattleEnd = useCallback(() => dispatch({ type: 'battleEnd' }), []);
  const replay = useBattleReplay({
    log: state.session?.log ?? EMPTY_LOG,
    allies: state.session?.allies ?? EMPTY_COMBATANTS,
    enemies: state.session?.enemies ?? EMPTY_COMBATANTS,
    nameToId: state.session?.nameToId ?? EMPTY_NAME_TO_ID,
    resetKey: state.battleId,
    playing,
    tickMs,
    onBattleEnd,
  });

  /**
   * Asks the server for the next battle. The client sends only intent — advance or repeat, and
   * which already-unlocked stage to fight — and the server decides the outcome, the payout and
   * where the run goes next (lib/battle-resolve.ts).
   *
   * `inFlightRef` keeps the auto-advance loop from stacking requests if one is slow: a battle
   * request is only ever issued when none is outstanding.
   */
  const inFlightRef = useRef(false);
  const requestBattle = useCallback(
    async (nextMode: 'advance' | 'repeat', position?: WorldPosition) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const response = await postApi<ResolveBattleResponse>('/api/battle/resolve', {
          mode: nextMode,
          retreatOnLoss,
          position,
        });
        setError(null);
        dispatch({
          type: 'reset',
          session: sessionFrom(response),
          frontier: response.frontier,
          recoveryWinsRemaining: response.recoveryWinsRemaining,
        });
        setPlaying(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível iniciar a batalha.');
      } finally {
        inFlightRef.current = false;
      }
    },
    [retreatOnLoss],
  );

  // First battle of the session.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    requestBattle('advance', initialPosition);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-advance: once the replay finishes, ask for the next battle. The server applies the
  // Avançar/Repetir/retirar-se-ao-perder rules and told us where to fight next.
  useEffect(() => {
    if (!replay.finished || !playing || !state.session) return;
    const nextPosition = state.nextPosition;
    const timer = setTimeout(() => {
      requestBattle(mode, nextPosition);
    }, autoAdvanceDelayMs);
    return () => clearTimeout(timer);
  }, [replay.finished, playing, state.session, state.nextPosition, mode, autoAdvanceDelayMs, requestBattle]);

  const startNewBattle = useCallback(() => {
    // Already advancing — the auto-advance effect is already driving this, so a redundant click
    // shouldn't queue a second battle. The exception is a stalled run: if the last request
    // failed, or none has landed yet, nothing is driving the loop and this is the retry.
    if (mode === 'advance' && state.session && !error) return;
    setMode('advance');
    requestBattle('advance', state.nextPosition);
  }, [mode, state.session, error, state.nextPosition, requestBattle]);

  const repeatBattle = useCallback(() => {
    // Already repeating — nothing to change; avoids restarting the current battle mid-fight.
    if (mode === 'repeat') return;
    setMode('repeat');
    const current = state.session ? { fase: state.session.fase, estagio: state.session.estagio } : state.nextPosition;
    requestBattle('repeat', current);
  }, [mode, state.session, state.nextPosition, requestBattle]);

  const playPosition = useCallback(
    (position: WorldPosition) => {
      requestBattle(mode, position);
    },
    [mode, requestBattle],
  );

  /** The mini-map's within-the-current-fase case of playPosition. */
  const playStage = useCallback(
    (estagio: number) => playPosition({ fase: (state.session ?? state.nextPosition).fase, estagio }),
    [playPosition, state.session, state.nextPosition],
  );

  const adjustCredits = useCallback((delta: number) => dispatch({ type: 'adjustCredits', delta }), []);
  const setWallet = useCallback((credits: number, xp: number) => dispatch({ type: 'setWallet', credits, xp }), []);

  // Before the first server response there is no battle to show, but the HUD still needs a
  // position to render — fall back to where the next battle will be fought.
  const viewedPosition = state.session ? { fase: state.session.fase, estagio: state.session.estagio } : state.nextPosition;
  const stageWorldId = worldIdForFase(viewedPosition.fase);
  const stageWorldDisplay = WORLD_DISPLAY_BY_ID[stageWorldId];

  return {
    allies: state.session ? toBattleUnits(state.session.allies, replay.replay, replay.replay.allyOrder, true) : [],
    enemies: state.session ? toBattleUnits(state.session.enemies, replay.replay, replay.replay.enemyOrder, false) : [],
    stage: {
      worldId: stageWorldId,
      worldName: stageWorldDisplay.name,
      worldSubtitle: stageWorldDisplay.subtitle,
      phase: viewedPosition.fase,
      stage: viewedPosition.estagio,
      // Each world's own last fase has a 6th slot for its boss, one past its 5 regular estágios.
      totalStages: localFaseNumber(viewedPosition.fase) === FASES_PER_WORLD ? ESTAGIOS_PER_FASE + 1 : ESTAGIOS_PER_FASE,
      isBoss: state.session?.isBoss ?? false,
      round: Math.floor(replay.replay.now),
    },
    logFeed: [...replay.abilityLogFeed, ...state.resultLogFeed],
    floaters: replay.floaters,
    activeAbilities: replay.activeAbilities,
    attackAnims: replay.attackAnims,
    credits: state.totalCredits,
    xp: state.totalXp,
    lastReward: state.lastReward,
    playing,
    finished: replay.finished,
    winner: replay.winner,
    setPlaying,
    startNewBattle,
    repeatBattle,
    mode,
    retreatOnLoss,
    setRetreatOnLoss,
    recoveryWinsRemaining: state.recoveryWinsRemaining,
    adjustCredits,
    setWallet,
    frontierFase: state.frontier.fase,
    frontierEstagio: state.frontier.estagio,
    playStage,
    playPosition,
    error,
  };
}
