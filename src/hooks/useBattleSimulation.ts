import { useCallback, useEffect, useReducer, useState } from 'react';
import { loadCharactersByIds, loadJurupariBoss, loadJurupariComuns } from '../engine/core/loader';
import { runBattle } from '../engine/core/battle';
import { Rng } from '../engine/core/rng';
import { applyReplayEntry, buildNameToId, createInitialReplayState, type ReplayState } from '../engine/core/replay';
import {
  difficultyMultiplier,
  enemyCountRange,
  ESTAGIOS_PER_FASE,
  isBossStage,
  nextStage,
  teamSizeMultiplier,
  type WorldPosition,
} from '../engine/core/progression';
import type { BattleLogEntry, Combatant } from '../engine/core/types';
import {
  DISPLAY_PORTRAIT_BY_TEMPLATE_ID,
  DISPLAY_RARITY_BY_TEMPLATE_ID,
  ENEMY_LEVEL_BY_TEMPLATE_ID,
  FALLBACK_ELEMENT,
  FALLBACK_FACTION,
  FALLBACK_RARITY,
} from '../data/engineDisplay';
import type { OwnedCharacter } from './useOwnedCharacters';
import type { ActiveStatus, BattleUnit, ChatMessage, StageInfo } from '../types';

interface BattleSession extends WorldPosition {
  seed: number;
  isBoss: boolean;
  ownedCharacters: OwnedCharacter[];
  allies: Combatant[];
  enemies: Combatant[];
  log: BattleLogEntry[];
  nameToId: Record<string, string>;
}

/**
 * Enemies are calibrated against the original 4-character team; a player's
 * owned roster can now be smaller (a solo starter, until Invocação ships), so
 * scale enemy stats down proportionally on top of the per-estágio difficulty.
 * Non-boss waves also roll a random enemy count within that estágio's
 * enemyCountRange, using a separate Rng seeded off the battle's own seed so
 * the roll is deterministic (repeatBattle reproduces it) without perturbing
 * the battle simulation's own Rng sequence.
 */
function createSession(seed: number, position: WorldPosition, ownedCharacters: OwnedCharacter[]): BattleSession {
  const boss = isBossStage(position);
  const allies = loadCharactersByIds(ownedCharacters.map((o) => ({ id: o.characterId, xp: o.xp })));
  const sizeFactor = teamSizeMultiplier(ownedCharacters.length);
  let enemies: Combatant[];
  if (boss) {
    enemies = loadJurupariBoss(sizeFactor);
  } else {
    const [min, max] = enemyCountRange(position.estagio);
    const compositionRng = new Rng(seed);
    const count = min + Math.floor(compositionRng.next() * (max - min + 1));
    enemies = loadJurupariComuns(count, difficultyMultiplier(position) * sizeFactor);
  }
  const result = runBattle(allies, enemies, { seed });
  return { seed, ...position, isBoss: boss, ownedCharacters, allies, enemies, log: result.log, nameToId: buildNameToId(allies, enemies) };
}

export type FloatingTextKind = 'damage' | 'crit' | 'heal' | 'shield';

export interface FloatingText {
  id: string;
  unitId: string;
  amount: number;
  kind: FloatingTextKind;
  createdAt: number;
}

/** How long a floating number stays on screen before being pruned. */
const FLOATER_LIFETIME_MS = 1100;

interface PlaybackState {
  session: BattleSession;
  replay: ReplayState;
  index: number;
  logFeed: ChatMessage[];
  floaters: FloatingText[];
  finished: boolean;
  winner: 'allies' | 'enemies' | 'draw' | null;
  totalCredits: number;
  totalXp: number;
  /** Credits/XP earned from this specific battle — set once it ends, shown on the winner overlay. */
  lastReward: Reward | null;
  /**
   * The player's real saved progress. Distinct from `session.fase/estagio`
   * (what's currently on screen) so that replaying an earlier estágio via
   * playStage — a "detour" — never regresses saved progress: it only ever
   * moves forward, via a normal win-advance from a non-detour session.
   */
  frontier: WorldPosition;
}

type Action =
  | { type: 'reset'; session: BattleSession; frontier: WorldPosition }
  | { type: 'tick' }
  | { type: 'pruneFloaters' }
  | { type: 'adjustCredits'; delta: number };

let chatIdCounter = 0;
let floaterIdCounter = 0;

// Only Jurupari.iso exists so far; both the world number and the (unimplemented)
// reward numbers below are placeholders until the real economy lands.
const WORLD_NUMBER = 1;
const WORLD_NAME = 'Jurupari';

const REWARDS: Record<'comuns' | 'boss', { win: { credits: number; xp: number }; lossOrDraw: { credits: number } }> = {
  comuns: { win: { credits: 20, xp: 15 }, lossOrDraw: { credits: 5 } },
  boss: { win: { credits: 80, xp: 40 }, lossOrDraw: { credits: 10 } },
};

export interface Reward {
  credits: number;
  xp: number;
}

/** Credits/XP earned for a battle's outcome — the single source both the log line and the running totals read from. */
function rewardFor(winner: 'allies' | 'enemies' | 'draw', session: BattleSession): Reward {
  const rewards = REWARDS[session.isBoss ? 'boss' : 'comuns'];
  return winner === 'allies' ? rewards.win : { credits: rewards.lossOrDraw.credits, xp: 0 };
}

/** "[1] Jurupari 1-6 / Venceu [+20 C / +15 XP]" — the only line the Log tab shows, once per finished battle. */
function buildBattleSummary(winner: 'allies' | 'enemies' | 'draw', session: BattleSession, reward: Reward): ChatMessage {
  const won = winner === 'allies';
  const resultLabel = won ? 'Venceu' : winner === 'draw' ? 'Empate' : 'Perdeu';
  const rewardText = won ? `+${reward.credits} C / +${reward.xp} XP` : `+${reward.credits} C`;
  const text = `[${WORLD_NUMBER}] ${WORLD_NAME} ${session.fase}-${session.estagio} / ${resultLabel} [${rewardText}]`;

  chatIdCounter += 1;
  return {
    id: `battle-log-${chatIdCounter}`,
    tab: 'log',
    text,
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    tone: won ? 'success' : winner === 'draw' ? 'system' : 'danger',
  };
}

/** What floating numbers (if any) a log entry should spawn, keyed by target unit id. */
function floatersFor(entry: BattleLogEntry, nameToId: Record<string, string>): Omit<FloatingText, 'id' | 'createdAt'>[] {
  switch (entry.kind) {
    case 'attack':
      if (entry.result.dodged) return [];
      return [
        {
          unitId: entry.result.defender.id,
          amount: entry.result.finalDamage,
          kind: entry.result.crit ? 'crit' : 'damage',
        },
      ];
    case 'statusTick':
      return [{ unitId: nameToId[entry.target], amount: entry.amount, kind: entry.tickKind === 'heal' ? 'heal' : 'damage' }];
    case 'heal':
      return [{ unitId: nameToId[entry.target], amount: entry.amount, kind: 'heal' }];
    case 'shieldGranted':
      return [{ unitId: nameToId[entry.target], amount: entry.amount, kind: 'shield' }];
    case 'enrage':
      return entry.damages.map((d) => ({ unitId: nameToId[d.target], amount: d.amount, kind: 'damage' as const }));
    default:
      return [];
  }
}

function buildInitialState(
  seed: number,
  position: WorldPosition,
  ownedCharacters: OwnedCharacter[],
  initialCredits: number,
  initialXp: number,
): PlaybackState {
  const session = createSession(seed, position, ownedCharacters);
  return {
    session,
    replay: createInitialReplayState(session.allies, session.enemies),
    index: 0,
    logFeed: [],
    floaters: [],
    finished: session.log.length === 0,
    winner: null,
    totalCredits: initialCredits,
    totalXp: initialXp,
    lastReward: null,
    frontier: position,
  };
}

function reducer(state: PlaybackState, action: Action): PlaybackState {
  if (action.type === 'reset') {
    return {
      session: action.session,
      replay: createInitialReplayState(action.session.allies, action.session.enemies),
      index: 0,
      // The Log tab and the wallet are history across battles, not just this one — carry them forward.
      logFeed: state.logFeed,
      totalCredits: state.totalCredits,
      totalXp: state.totalXp,
      floaters: [],
      finished: action.session.log.length === 0,
      winner: null,
      lastReward: null,
      frontier: action.frontier,
    };
  }

  if (action.type === 'pruneFloaters') {
    const now = Date.now();
    const floaters = state.floaters.filter((f) => now - f.createdAt < FLOATER_LIFETIME_MS);
    return floaters.length === state.floaters.length ? state : { ...state, floaters };
  }

  if (action.type === 'adjustCredits') {
    return { ...state, totalCredits: Math.max(0, state.totalCredits + action.delta) };
  }

  if (state.finished || state.index >= state.session.log.length) {
    return state.finished ? state : { ...state, finished: true };
  }

  const entry = state.session.log[state.index];
  const replay = applyReplayEntry(state.replay, entry, state.session.nameToId);

  let logFeed = state.logFeed;
  let totalCredits = state.totalCredits;
  let totalXp = state.totalXp;
  let lastReward = state.lastReward;
  if (entry.kind === 'battleEnd') {
    const reward = rewardFor(entry.winner, state.session);
    logFeed = [...state.logFeed, buildBattleSummary(entry.winner, state.session, reward)];
    totalCredits += reward.credits;
    totalXp += reward.xp;
    lastReward = reward;
  }

  const now = Date.now();
  const newFloaters = floatersFor(entry, state.session.nameToId)
    .filter((f) => f.unitId)
    .map((f) => {
      floaterIdCounter += 1;
      return { ...f, id: `floater-${floaterIdCounter}`, createdAt: now };
    });
  const winner = entry.kind === 'battleEnd' ? entry.winner : state.winner;
  const index = state.index + 1;

  return {
    ...state,
    replay,
    index,
    logFeed,
    totalCredits,
    totalXp,
    lastReward,
    floaters: [...state.floaters, ...newFloaters],
    winner,
    finished: index >= state.session.log.length,
  };
}

function toActiveStatuses(statuses: ReplayState['units'][string]['statuses']): ActiveStatus[] {
  return Object.entries(statuses)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([type, count]) => ({ type: type as ActiveStatus['type'], count: count ?? 0 }));
}

function toBattleUnits(templates: Combatant[], replay: ReplayState, order: string[]): BattleUnit[] {
  const byId = new Map(templates.map((t) => [t.id, t]));
  return order.map((id) => {
    const t = byId.get(id)!;
    const snapshot = replay.units[t.id];
    return {
      id: t.id,
      name: t.name,
      faction: t.faction ?? FALLBACK_FACTION,
      element: t.element ?? FALLBACK_ELEMENT,
      rarity: DISPLAY_RARITY_BY_TEMPLATE_ID[t.templateId] ?? FALLBACK_RARITY,
      // Allies carry a real level (derived from XP); enemies use a cosmetic per-templateId number.
      level: t.isAlly ? t.level : (ENEMY_LEVEL_BY_TEMPLATE_ID[t.templateId] ?? 1),
      hp: snapshot?.hp ?? t.maxHp,
      maxHp: t.maxHp,
      shield: snapshot?.shield ?? 0,
      statuses: snapshot ? toActiveStatuses(snapshot.statuses) : [],
      isAlly: t.isAlly,
      portraitUrl: DISPLAY_PORTRAIT_BY_TEMPLATE_ID[t.templateId],
    };
  });
}

export interface UseBattleSimulationOptions {
  /** The player's owned characters (id + xp) — who actually fights. Always required; there's no fallback team anymore. */
  initialOwnedCharacters: OwnedCharacter[];
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
  /** Créditos/XP earned since `initialCredits`/`initialXp` — the caller is responsible for persisting these. */
  credits: number;
  xp: number;
  /** Créditos/XP earned from the battle that just finished, for the winner overlay — null until one ends. */
  lastReward: Reward | null;
  playing: boolean;
  finished: boolean;
  winner: 'allies' | 'enemies' | 'draw' | null;
  setPlaying: (playing: boolean) => void;
  /** Jumps immediately to the next attempt: next estágio on a win, retry this one on a loss/draw ("Avançar"). */
  startNewBattle: () => void;
  /** Replays this exact estágio with the exact same seed ("Repetir estágio"). */
  repeatBattle: () => void;
  /** Spends (negative) or grants (positive) credits outside of battle rewards — the Loja's purchase/sale/claim primitive. Clamped at 0. */
  adjustCredits: (delta: number) => void;
  /** The player's real saved position (mini-map dots before this are completed) — distinct from `stage` while detouring via playStage. */
  frontierFase: number;
  frontierEstagio: number;
  /** Jumps to replay a previously-completed estágio within the current fase (the mini-map) without disturbing saved progress — the next Avançar/auto-advance returns to the frontier instead of continuing from here. */
  playStage: (estagio: number) => void;
}

export function useBattleSimulation(options: UseBattleSimulationOptions): BattleSimulation {
  const {
    initialOwnedCharacters,
    tickMs = 500,
    autoAdvanceDelayMs = 1600,
    initialPosition = { fase: 1, estagio: 1 },
    initialCredits = 0,
    initialXp = 0,
  } = options;
  const [playing, setPlaying] = useState(true);
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    buildInitialState(Date.now() >>> 0, initialPosition, initialOwnedCharacters, initialCredits, initialXp),
  );

  useEffect(() => {
    if (!playing || state.finished) return;
    const id = setInterval(() => dispatch({ type: 'tick' }), tickMs);
    return () => clearInterval(id);
  }, [playing, state.finished, state.session, tickMs]);

  useEffect(() => {
    if (state.floaters.length === 0) return;
    const id = setInterval(() => dispatch({ type: 'pruneFloaters' }), 250);
    return () => clearInterval(id);
  }, [state.floaters.length]);

  // World progression: on a win, move to the next estágio (or loop to 1-1 after the boss);
  // on a loss/draw, retry the same estágio with a fresh seed. Only while Auto is on.
  // Uses the *current* initialOwnedCharacters (not state.session.ownedCharacters, which is
  // frozen at whatever the previous battle started with) so XP earned since the last battle
  // is reflected in the next one's stats, not just in the Team page display.
  useEffect(() => {
    if (!state.finished || !playing) return;
    const position: WorldPosition = { fase: state.session.fase, estagio: state.session.estagio };
    const isDetour = position.fase !== state.frontier.fase || position.estagio !== state.frontier.estagio;
    const target = isDetour ? state.frontier : state.winner === 'allies' ? nextStage(position) : position;
    const nextFrontier = isDetour ? state.frontier : target;
    const timer = setTimeout(() => {
      dispatch({ type: 'reset', session: createSession(Date.now() >>> 0, target, initialOwnedCharacters), frontier: nextFrontier });
    }, autoAdvanceDelayMs);
    return () => clearTimeout(timer);
  }, [state.finished, state.winner, state.session, state.frontier, playing, autoAdvanceDelayMs, initialOwnedCharacters]);

  const startNewBattle = useCallback(() => {
    const position: WorldPosition = { fase: state.session.fase, estagio: state.session.estagio };
    const isDetour = position.fase !== state.frontier.fase || position.estagio !== state.frontier.estagio;
    const target = isDetour ? state.frontier : state.winner === 'allies' ? nextStage(position) : position;
    const nextFrontier = isDetour ? state.frontier : target;
    dispatch({ type: 'reset', session: createSession(Date.now() >>> 0, target, initialOwnedCharacters), frontier: nextFrontier });
    setPlaying(true);
  }, [state.session.fase, state.session.estagio, state.frontier, state.winner, initialOwnedCharacters]);

  const repeatBattle = useCallback(() => {
    dispatch({
      type: 'reset',
      session: createSession(state.session.seed, { fase: state.session.fase, estagio: state.session.estagio }, initialOwnedCharacters),
      frontier: state.frontier,
    });
    setPlaying(true);
  }, [state.session.seed, state.session.fase, state.session.estagio, state.frontier, initialOwnedCharacters]);

  const playStage = useCallback(
    (estagio: number) => {
      dispatch({
        type: 'reset',
        session: createSession(Date.now() >>> 0, { fase: state.frontier.fase, estagio }, initialOwnedCharacters),
        frontier: state.frontier,
      });
      setPlaying(true);
    },
    [state.frontier, initialOwnedCharacters],
  );

  const adjustCredits = useCallback((delta: number) => dispatch({ type: 'adjustCredits', delta }), []);

  return {
    allies: toBattleUnits(state.session.allies, state.replay, state.replay.allyOrder),
    enemies: toBattleUnits(state.session.enemies, state.replay, state.replay.enemyOrder),
    stage: {
      worldName: 'Jurupari.iso',
      worldSubtitle: 'Folclore Brasileiro',
      phase: state.session.fase,
      stage: state.session.estagio,
      totalStages: ESTAGIOS_PER_FASE,
      isBoss: state.session.isBoss,
      round: state.replay.round,
      turn: state.replay.turnInRound,
    },
    logFeed: state.logFeed,
    floaters: state.floaters,
    credits: state.totalCredits,
    xp: state.totalXp,
    lastReward: state.lastReward,
    playing,
    finished: state.finished,
    winner: state.winner,
    setPlaying,
    startNewBattle,
    repeatBattle,
    adjustCredits,
    frontierFase: state.frontier.fase,
    frontierEstagio: state.frontier.estagio,
    playStage,
  };
}
