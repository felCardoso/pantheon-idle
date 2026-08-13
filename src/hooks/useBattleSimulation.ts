import { useCallback, useEffect, useReducer, useState } from 'react';
import { loadJurupariAllies, loadJurupariBoss, loadJurupariComuns } from '../engine/core/loader';
import { runBattle } from '../engine/core/battle';
import { applyReplayEntry, buildNameToId, createInitialReplayState, type ReplayState } from '../engine/core/replay';
import type { BattleLogEntry, Combatant } from '../engine/core/types';
import {
  DISPLAY_LEVEL_BY_TEMPLATE_ID,
  DISPLAY_PORTRAIT_BY_TEMPLATE_ID,
  DISPLAY_RARITY_BY_TEMPLATE_ID,
  FALLBACK_ELEMENT,
  FALLBACK_FACTION,
  FALLBACK_RARITY,
} from '../data/engineDisplay';
import type { ActiveStatus, BattleUnit, ChatMessage, StageInfo } from '../types';

interface BattleSession {
  seed: number;
  useBoss: boolean;
  allies: Combatant[];
  enemies: Combatant[];
  log: BattleLogEntry[];
  nameToId: Record<string, string>;
}

function createSession(seed: number, useBoss: boolean): BattleSession {
  const allies = loadJurupariAllies();
  const enemies = useBoss ? loadJurupariBoss() : loadJurupariComuns();
  const result = runBattle(allies, enemies, { seed });
  return { seed, useBoss, allies, enemies, log: result.log, nameToId: buildNameToId(allies, enemies) };
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
}

type Action = { type: 'reset'; session: BattleSession } | { type: 'tick' } | { type: 'pruneFloaters' };

let chatIdCounter = 0;
let floaterIdCounter = 0;

// Only Jurupari.iso exists so far; both the world number and the (unimplemented)
// reward numbers below are placeholders until the real economy/progression lands.
const WORLD_NUMBER = 1;
const WORLD_NAME = 'Jurupari';

const REWARDS: Record<'comuns' | 'boss', { win: { credits: number; xp: number }; lossOrDraw: { credits: number } }> = {
  comuns: { win: { credits: 20, xp: 15 }, lossOrDraw: { credits: 5 } },
  boss: { win: { credits: 80, xp: 40 }, lossOrDraw: { credits: 10 } },
};

/** Fase/Estágio shown for the current encounter — only Jurupari.iso exists so far. */
function worldStageOf(useBoss: boolean): { phase: number; stage: number } {
  return { phase: 1, stage: useBoss ? 10 : 6 };
}

/** "[1] Jurupari 1-6 / Venceu [+20 C / +15 XP]" — the only line the Log tab shows, once per finished battle. */
function buildBattleSummary(winner: 'allies' | 'enemies' | 'draw', useBoss: boolean): ChatMessage {
  const { phase, stage } = worldStageOf(useBoss);
  const rewards = REWARDS[useBoss ? 'boss' : 'comuns'];
  const won = winner === 'allies';
  const resultLabel = won ? 'Venceu' : winner === 'draw' ? 'Empate' : 'Perdeu';
  const rewardText = won ? `+${rewards.win.credits} C / +${rewards.win.xp} XP` : `+${rewards.lossOrDraw.credits} C`;
  const text = `[${WORLD_NUMBER}] ${WORLD_NAME} ${phase}-${stage} / ${resultLabel} [${rewardText}]`;

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

function buildInitialState(seed: number, useBoss: boolean): PlaybackState {
  const session = createSession(seed, useBoss);
  return {
    session,
    replay: createInitialReplayState(session.allies, session.enemies),
    index: 0,
    logFeed: [],
    floaters: [],
    finished: session.log.length === 0,
    winner: null,
  };
}

function reducer(state: PlaybackState, action: Action): PlaybackState {
  if (action.type === 'reset') {
    return {
      session: action.session,
      replay: createInitialReplayState(action.session.allies, action.session.enemies),
      index: 0,
      // The Log tab is a history across battles, not just this one — carry it forward.
      logFeed: state.logFeed,
      floaters: [],
      finished: action.session.log.length === 0,
      winner: null,
    };
  }

  if (action.type === 'pruneFloaters') {
    const now = Date.now();
    const floaters = state.floaters.filter((f) => now - f.createdAt < FLOATER_LIFETIME_MS);
    return floaters.length === state.floaters.length ? state : { ...state, floaters };
  }

  if (state.finished || state.index >= state.session.log.length) {
    return state.finished ? state : { ...state, finished: true };
  }

  const entry = state.session.log[state.index];
  const replay = applyReplayEntry(state.replay, entry, state.session.nameToId);
  const logFeed =
    entry.kind === 'battleEnd'
      ? [...state.logFeed, buildBattleSummary(entry.winner, state.session.useBoss)]
      : state.logFeed;
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

function toBattleUnits(templates: Combatant[], replay: ReplayState): BattleUnit[] {
  return templates.map((t) => {
    const snapshot = replay.units[t.id];
    return {
      id: t.id,
      name: t.name,
      faction: t.faction ?? FALLBACK_FACTION,
      element: t.element ?? FALLBACK_ELEMENT,
      rarity: DISPLAY_RARITY_BY_TEMPLATE_ID[t.templateId] ?? FALLBACK_RARITY,
      level: DISPLAY_LEVEL_BY_TEMPLATE_ID[t.templateId] ?? 1,
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
  useBoss?: boolean;
  /** Milliseconds between revealed log entries while playing. */
  tickMs?: number;
}

export interface BattleSimulation {
  allies: BattleUnit[];
  enemies: BattleUnit[];
  stage: StageInfo;
  logFeed: ChatMessage[];
  floaters: FloatingText[];
  playing: boolean;
  finished: boolean;
  winner: 'allies' | 'enemies' | 'draw' | null;
  setPlaying: (playing: boolean) => void;
  /** Starts a brand-new battle with a fresh seed ("Avançar"). */
  startNewBattle: () => void;
  /** Replays the exact same battle from scratch ("Repetir estágio"). */
  repeatBattle: () => void;
}

export function useBattleSimulation(options: UseBattleSimulationOptions = {}): BattleSimulation {
  const { useBoss = false, tickMs = 550 } = options;
  const [playing, setPlaying] = useState(true);
  const [state, dispatch] = useReducer(reducer, undefined, () => buildInitialState(Date.now() >>> 0, useBoss));

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

  const startNewBattle = useCallback(() => {
    dispatch({ type: 'reset', session: createSession(Date.now() >>> 0, useBoss) });
    setPlaying(true);
  }, [useBoss]);

  const repeatBattle = useCallback(() => {
    dispatch({ type: 'reset', session: createSession(state.session.seed, useBoss) });
    setPlaying(true);
  }, [state.session.seed, useBoss]);

  return {
    allies: toBattleUnits(state.session.allies, state.replay),
    enemies: toBattleUnits(state.session.enemies, state.replay),
    stage: {
      worldName: 'Jurupari.iso',
      worldSubtitle: 'Folclore Brasileiro',
      ...worldStageOf(useBoss),
      totalStages: 10,
      round: state.replay.round,
      turn: state.replay.turnInRound,
    },
    logFeed: state.logFeed,
    floaters: state.floaters,
    playing,
    finished: state.finished,
    winner: state.winner,
    setPlaying,
    startNewBattle,
    repeatBattle,
  };
}
