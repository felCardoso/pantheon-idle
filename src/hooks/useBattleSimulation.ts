import { useCallback, useEffect, useReducer, useState } from 'react';
import {
  buildNameToId,
  difficultyMultiplier,
  enemyCountRange,
  ESTAGIOS_PER_FASE,
  FASES_PER_WORLD,
  isBossStage,
  loadCharactersByIds,
  loadWorldBoss,
  loadWorldComuns,
  localFaseNumber,
  resolveProgression,
  Rng,
  runBattle,
  teamSizeMultiplier,
  worldIdForFase,
  worldIndexForFase,
  type BattleLogEntry,
  type Combatant,
  type WorldPosition,
} from '../engine';
import { WORLD_DISPLAY_BY_ID } from '../data/engineDisplay';
import { toBattleUnits } from '../data/battleUnits';
import { useBattleReplay, type AbilityCastEvent, type AttackAnimEvent, type FloatingText } from './useBattleReplay';
import type { OwnedCharacter } from './useOwnedCharacters';
import type { BattleUnit, ChatMessage, StageInfo } from '../types';

export type { FloatingText, FloatingTextKind, AbilityCastEvent, AttackAnimEvent, AttackAnimTier } from './useBattleReplay';

interface BattleSession extends WorldPosition {
  seed: number;
  isBoss: boolean;
  ownedCharacters: OwnedCharacter[];
  allies: Combatant[];
  enemies: Combatant[];
  log: BattleLogEntry[];
  nameToId: Record<string, string>;
  /** Combined Root Access (+15%) / Cluster (+25%) reward multiplier in effect when this battle started — see usePlayerProgress.ts's VIP_CREDIT_XP_BONUS_PERCENT/CLUSTER_CREDIT_XP_BONUS_PERCENT. */
  bonusMultiplier: number;
}

/**
 * Enemies are calibrated against the original 4-character team; a player's
 * owned roster can now be smaller (a solo starter, until Invocação ships), so
 * scale enemy stats down proportionally on top of the per-estágio and
 * per-world difficulty. Non-boss waves also roll a random enemy count within
 * that estágio's enemyCountRange, using a separate Rng seeded off the
 * battle's own seed so the roll is deterministic (repeatBattle reproduces
 * it) without perturbing the battle simulation's own Rng sequence.
 */
function createSession(
  seed: number,
  position: WorldPosition,
  ownedCharacters: OwnedCharacter[],
  bonusMultiplier: number,
  selectedAbilityByCharacterId: Record<string, string>,
): BattleSession {
  const boss = isBossStage(position);
  const worldId = worldIdForFase(position.fase);
  const allies = loadCharactersByIds(
    ownedCharacters.map((o) => ({ id: o.characterId, xp: o.xp, rarity: o.rarity, selectedAbilityId: selectedAbilityByCharacterId[o.characterId] })),
  );
  const sizeFactor = teamSizeMultiplier(ownedCharacters.length);
  let enemies: Combatant[];
  if (boss) {
    // The boss only ever appears once per world (no intra-estágio scaling), but should still be
    // that world's base multiplier harder than the previous world's boss — difficultyMultiplier at
    // estágio 1 is exactly that base (no +5%-per-estágio component applied).
    enemies = loadWorldBoss(worldId, sizeFactor * difficultyMultiplier({ fase: position.fase, estagio: 1 }));
  } else {
    const [min, max] = enemyCountRange(position.estagio);
    const compositionRng = new Rng(seed);
    const count = min + Math.floor(compositionRng.next() * (max - min + 1));
    enemies = loadWorldComuns(worldId, count, difficultyMultiplier(position) * sizeFactor);
  }
  const result = runBattle(allies, enemies, { seed });
  return { seed, ...position, isBoss: boss, ownedCharacters, allies, enemies, log: result.log, nameToId: buildNameToId(allies, enemies), bonusMultiplier };
}

// The reward numbers below are the same across every world — a placeholder
// until the real per-world economy (docs/mundos.md's "recompensas
// específicas" per world) lands.
const REWARDS: Record<'comuns' | 'boss', { win: { credits: number; xp: number }; lossOrDraw: { credits: number } }> = {
  comuns: { win: { credits: 20, xp: 15 }, lossOrDraw: { credits: 5 } },
  boss: { win: { credits: 80, xp: 40 }, lossOrDraw: { credits: 10 } },
};

export interface Reward {
  credits: number;
  xp: number;
}

/** Credits/XP earned for a battle's outcome — the single source both the log line and the running totals read from. Root Access/Cluster bonuses apply to both win and loss/draw payouts. */
function rewardFor(winner: 'allies' | 'enemies' | 'draw', session: BattleSession): Reward {
  const rewards = REWARDS[session.isBoss ? 'boss' : 'comuns'];
  const base = winner === 'allies' ? rewards.win : { credits: rewards.lossOrDraw.credits, xp: 0 };
  return { credits: Math.round(base.credits * session.bonusMultiplier), xp: Math.round(base.xp * session.bonusMultiplier) };
}

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
  session: BattleSession;
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
  /** Non-null while grinding back up after a retirar-se-ao-perder retreat — see progression.ts's resolveProgression. */
  recoveryWinsRemaining: number | null;
}

type SessionAction =
  | { type: 'reset'; session: BattleSession; frontier: WorldPosition; recoveryWinsRemaining: number | null }
  | { type: 'battleEnd'; winner: 'allies' | 'enemies' | 'draw' }
  | { type: 'adjustCredits'; delta: number }
  | { type: 'setWallet'; credits: number; xp: number };

function buildInitialSession(
  seed: number,
  position: WorldPosition,
  ownedCharacters: OwnedCharacter[],
  initialCredits: number,
  initialXp: number,
  bonusMultiplier: number,
  selectedAbilityByCharacterId: Record<string, string>,
): SessionState {
  return {
    session: createSession(seed, position, ownedCharacters, bonusMultiplier, selectedAbilityByCharacterId),
    battleId: 0,
    resultLogFeed: [],
    totalCredits: initialCredits,
    totalXp: initialXp,
    lastReward: null,
    frontier: position,
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
        recoveryWinsRemaining: action.recoveryWinsRemaining,
      };
    case 'battleEnd': {
      const reward = rewardFor(action.winner, state.session);
      return {
        ...state,
        resultLogFeed: [...state.resultLogFeed, buildBattleSummary(action.winner, state.session, reward)],
        totalCredits: state.totalCredits + reward.credits,
        totalXp: state.totalXp + reward.xp,
        lastReward: reward,
      };
    }
    case 'adjustCredits':
      return { ...state, totalCredits: Math.max(0, state.totalCredits + action.delta) };
    case 'setWallet':
      return { ...state, totalCredits: action.credits, totalXp: action.xp };
  }
}

export interface UseBattleSimulationOptions {
  /** The player's owned characters (id + xp) — who actually fights. Always required; there's no fallback team anymore. */
  initialOwnedCharacters: OwnedCharacter[];
  /** Keyed by characterId — the player's equipped active ability, from useCharacterProgression. Missing entries fall back to activeOptions[0] (see loader.ts's resolveCombatantAbilities). Read fresh on every new battle, same as bonusMultiplier. */
  selectedAbilityByCharacterId?: Record<string, string>;
  /** Milliseconds between revealed log entries while playing. */
  tickMs?: number;
  /** Pause after Vitória!/Derrota before auto-advancing to the next attempt. */
  autoAdvanceDelayMs?: number;
  /** Resume from a saved world position instead of starting at fase 1, estágio 1. */
  initialPosition?: WorldPosition;
  /** Resume from a saved wallet instead of starting at 0. */
  initialCredits?: number;
  initialXp?: number;
  /** Combined Root Access/Cluster reward multiplier (1 = no bonus) — read fresh on every new battle, not just at mount. */
  bonusMultiplier?: number;
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
}

export function useBattleSimulation(options: UseBattleSimulationOptions): BattleSimulation {
  const {
    initialOwnedCharacters,
    selectedAbilityByCharacterId = {},
    tickMs = 500,
    autoAdvanceDelayMs = 1600,
    initialPosition = { fase: 1, estagio: 1 },
    initialCredits = 0,
    initialXp = 0,
    bonusMultiplier = 1,
  } = options;
  const [playing, setPlaying] = useState(true);
  // 'advance' (Avançar) or 'repeat' (Repetir estágio) — which resolveProgression rules apply on
  // each finish. Kept outside the reducer since it's UI-driven mode, not battle state.
  const [mode, setMode] = useState<'advance' | 'repeat'>('advance');
  const [retreatOnLoss, setRetreatOnLoss] = useState(true);
  const [state, dispatch] = useReducer(sessionReducer, undefined, () =>
    buildInitialSession(Date.now() >>> 0, initialPosition, initialOwnedCharacters, initialCredits, initialXp, bonusMultiplier, selectedAbilityByCharacterId),
  );

  const onBattleEnd = useCallback((winner: 'allies' | 'enemies' | 'draw') => dispatch({ type: 'battleEnd', winner }), []);
  const replay = useBattleReplay({
    log: state.session.log,
    allies: state.session.allies,
    enemies: state.session.enemies,
    nameToId: state.session.nameToId,
    resetKey: state.battleId,
    playing,
    tickMs,
    onBattleEnd,
  });

  // World progression — see progression.ts's resolveProgression for the full Avançar/Repetir/
  // retirar-se-ao-perder rules this follows. Only while Auto is on.
  // Uses the *current* initialOwnedCharacters (not state.session.ownedCharacters, which is
  // frozen at whatever the previous battle started with) so XP earned since the last battle
  // is reflected in the next one's stats, not just in the Team page display.
  useEffect(() => {
    if (!replay.finished || !playing) return;
    const position: WorldPosition = { fase: state.session.fase, estagio: state.session.estagio };
    const won = replay.winner === 'allies';
    const result = resolveProgression(
      { position, frontier: state.frontier, recoveryWinsRemaining: state.recoveryWinsRemaining },
      { mode, retreatOnLoss, won },
    );
    const timer = setTimeout(() => {
      dispatch({
        type: 'reset',
        session: createSession(Date.now() >>> 0, result.position, initialOwnedCharacters, bonusMultiplier, selectedAbilityByCharacterId),
        frontier: result.frontier,
        recoveryWinsRemaining: result.recoveryWinsRemaining,
      });
    }, autoAdvanceDelayMs);
    return () => clearTimeout(timer);
  }, [
    replay.finished,
    replay.winner,
    state.session,
    state.frontier,
    state.recoveryWinsRemaining,
    playing,
    mode,
    retreatOnLoss,
    autoAdvanceDelayMs,
    initialOwnedCharacters,
    bonusMultiplier,
    selectedAbilityByCharacterId,
  ]);

  const startNewBattle = useCallback(() => {
    // Already advancing — the auto-advance effect is already driving this; a redundant click
    // shouldn't force an extra resolveProgression pass against whatever the battle's current
    // (possibly mid-fight) winner happens to be.
    if (mode === 'advance') return;
    setMode('advance');
    const position: WorldPosition = { fase: state.session.fase, estagio: state.session.estagio };
    const won = replay.winner === 'allies';
    const result = resolveProgression(
      { position, frontier: state.frontier, recoveryWinsRemaining: state.recoveryWinsRemaining },
      { mode: 'advance', retreatOnLoss, won },
    );
    dispatch({
      type: 'reset',
      session: createSession(Date.now() >>> 0, result.position, initialOwnedCharacters, bonusMultiplier, selectedAbilityByCharacterId),
      frontier: result.frontier,
      recoveryWinsRemaining: result.recoveryWinsRemaining,
    });
    setPlaying(true);
  }, [
    mode,
    state.session.fase,
    state.session.estagio,
    replay.winner,
    state.frontier,
    state.recoveryWinsRemaining,
    retreatOnLoss,
    initialOwnedCharacters,
    bonusMultiplier,
    selectedAbilityByCharacterId,
  ]);

  const repeatBattle = useCallback(() => {
    // Already repeating — nothing to change; avoids restarting the current battle mid-fight.
    if (mode === 'repeat') return;
    setMode('repeat');
    const position: WorldPosition = { fase: state.session.fase, estagio: state.session.estagio };
    const won = replay.winner === 'allies';
    const result = resolveProgression(
      { position, frontier: state.frontier, recoveryWinsRemaining: state.recoveryWinsRemaining },
      { mode: 'repeat', retreatOnLoss, won },
    );
    // Reuse the exact same seed for a true instant-replay when nothing moved; a retreat lands on
    // a different estágio entirely, so a fresh seed makes more sense there.
    const seed = result.position.fase === position.fase && result.position.estagio === position.estagio ? state.session.seed : Date.now() >>> 0;
    dispatch({
      type: 'reset',
      session: createSession(seed, result.position, initialOwnedCharacters, bonusMultiplier, selectedAbilityByCharacterId),
      frontier: result.frontier,
      recoveryWinsRemaining: result.recoveryWinsRemaining,
    });
    setPlaying(true);
  }, [
    mode,
    state.session.fase,
    state.session.estagio,
    state.session.seed,
    replay.winner,
    state.frontier,
    state.recoveryWinsRemaining,
    retreatOnLoss,
    initialOwnedCharacters,
    bonusMultiplier,
    selectedAbilityByCharacterId,
  ]);

  const playPosition = useCallback(
    (position: WorldPosition) => {
      dispatch({
        type: 'reset',
        session: createSession(Date.now() >>> 0, position, initialOwnedCharacters, bonusMultiplier, selectedAbilityByCharacterId),
        frontier: state.frontier,
        recoveryWinsRemaining: null,
      });
      setPlaying(true);
    },
    [state.frontier, initialOwnedCharacters, bonusMultiplier, selectedAbilityByCharacterId],
  );

  /** The mini-map's within-the-current-fase case of playPosition. */
  const playStage = useCallback(
    (estagio: number) => playPosition({ fase: state.session.fase, estagio }),
    [playPosition, state.session.fase],
  );

  const adjustCredits = useCallback((delta: number) => dispatch({ type: 'adjustCredits', delta }), []);
  const setWallet = useCallback((credits: number, xp: number) => dispatch({ type: 'setWallet', credits, xp }), []);

  const stageWorldId = worldIdForFase(state.session.fase);
  const stageWorldDisplay = WORLD_DISPLAY_BY_ID[stageWorldId];

  return {
    allies: toBattleUnits(state.session.allies, replay.replay, replay.replay.allyOrder, true),
    enemies: toBattleUnits(state.session.enemies, replay.replay, replay.replay.enemyOrder, false),
    stage: {
      worldId: stageWorldId,
      worldName: stageWorldDisplay.name,
      worldSubtitle: stageWorldDisplay.subtitle,
      phase: state.session.fase,
      stage: state.session.estagio,
      // Each world's own last fase has a 6th slot for its boss, one past its 5 regular estágios.
      totalStages: localFaseNumber(state.session.fase) === FASES_PER_WORLD ? ESTAGIOS_PER_FASE + 1 : ESTAGIOS_PER_FASE,
      isBoss: state.session.isBoss,
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
  };
}
