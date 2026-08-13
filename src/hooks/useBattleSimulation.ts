import { useCallback, useEffect, useReducer, useState } from 'react';
import { loadJurupariAllies, loadJurupariBoss, loadJurupariComuns } from '../engine/core/loader';
import { runBattle } from '../engine/core/battle';
import { applyReplayEntry, buildNameToId, createInitialReplayState, type ReplayState } from '../engine/core/replay';
import { formatLogEntry } from '../engine/cli/format';
import type { BattleLogEntry, Combatant } from '../engine/core/types';
import {
  DISPLAY_LEVEL_BY_TEMPLATE_ID,
  DISPLAY_RARITY_BY_TEMPLATE_ID,
  FALLBACK_ELEMENT,
  FALLBACK_FACTION,
  FALLBACK_RARITY,
} from '../data/engineDisplay';
import type { BattleUnit, ChatMessage, StageInfo } from '../types';

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

interface PlaybackState {
  session: BattleSession;
  replay: ReplayState;
  index: number;
  logFeed: ChatMessage[];
  finished: boolean;
  winner: 'allies' | 'enemies' | 'draw' | null;
}

type Action = { type: 'reset'; session: BattleSession } | { type: 'tick' };

let chatIdCounter = 0;

function toneFor(entry: BattleLogEntry): ChatMessage['tone'] {
  if (entry.kind === 'battleEnd') return entry.winner === 'allies' ? 'success' : entry.winner === 'enemies' ? 'danger' : 'system';
  if (entry.kind === 'enrage') return 'system';
  if (entry.kind === 'attack' && entry.result.crit) return 'success';
  return 'default';
}

function buildInitialState(seed: number, useBoss: boolean): PlaybackState {
  const session = createSession(seed, useBoss);
  return {
    session,
    replay: createInitialReplayState(session.allies, session.enemies),
    index: 0,
    logFeed: [],
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
      logFeed: [],
      finished: action.session.log.length === 0,
      winner: null,
    };
  }

  if (state.finished || state.index >= state.session.log.length) {
    return state.finished ? state : { ...state, finished: true };
  }

  const entry = state.session.log[state.index];
  const replay = applyReplayEntry(state.replay, entry, state.session.nameToId);
  const line = formatLogEntry(entry);
  chatIdCounter += 1;
  const logFeed = line
    ? [...state.logFeed, { id: `battle-log-${chatIdCounter}`, tab: 'log' as const, text: line.trim(), time: `R${replay.round}`, tone: toneFor(entry) }]
    : state.logFeed;
  const winner = entry.kind === 'battleEnd' ? entry.winner : state.winner;
  const index = state.index + 1;

  return { ...state, replay, index, logFeed, winner, finished: index >= state.session.log.length };
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
      isAlly: t.isAlly,
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
      phase: 1,
      stage: useBoss ? 10 : 6,
      totalStages: 10,
      round: state.replay.round,
      turn: state.replay.turnInRound,
    },
    logFeed: state.logFeed,
    playing,
    finished: state.finished,
    winner: state.winner,
    setPlaying,
    startNewBattle,
    repeatBattle,
  };
}
