import { useEffect, useReducer, useState } from 'react';
import { applyTurnReplayEntry, createInitialTurnReplayState, type TurnBattleLogEntry, type TurnCombatant, type TurnReplayState } from '../engine';
import { DISPLAY_PORTRAIT_BY_TEMPLATE_ID } from '../data/engineDisplay';
import { describeAbilityEffect } from '../data/abilityDescriptions';
import type { ChatMessage } from '../types';
import type { AbilityCastEvent, AttackAnimEvent, FloatingText } from './useBattleReplay';

/**
 * Turn-mode's counterpart to useBattleReplay.ts — steps an already-finished PvE turn battle's
 * log forward on a real interval, producing the same shapes (floaters, ability-cast callouts,
 * attack anims, a log feed) so BattleStage/AbilityCastOverlay/TeamFormation need no changes at
 * all: they only ever consumed those shapes, never the real-time engine's own types.
 *
 * Deliberately simpler than the real-time original: turn mode has no Vanguard/queue concept (no
 * `vanguardEnter/Exit`, no rotation) and no continuous clock to read attack pacing off of (every
 * entry is one discrete round-step, not a timestamp in seconds) — so there's a single attack
 * animation tier and no idle watchdog/forced-cast-flourish logic. See src/engine/turn/replay.ts
 * for the snapshot-stepping half of this.
 */

const FLOATER_LIFETIME_MS = 1100;
const ABILITY_CAST_LIFETIME_MS = 1800;
const ATTACK_ANIM_LIFETIME_MS = 480;
/** Minimum gap between two full-screen cast callouts — see useBattleReplay.ts's identical constant. */
const FULL_CAST_INTERVAL_MS = 10_000;

function floatersFor(entry: TurnBattleLogEntry, nameToId: Record<string, string>): Omit<FloatingText, 'id' | 'createdAt'>[] {
  switch (entry.kind) {
    case 'attack':
      if (entry.result.dodged) return [];
      return [{ unitId: entry.result.defender.id, amount: entry.result.finalDamage, kind: entry.result.crit ? 'crit' : 'damage' }];
    case 'statusTick':
      return [{ unitId: nameToId[entry.target], amount: entry.amount, kind: entry.tickKind === 'heal' ? 'heal' : 'damage' }];
    case 'heal':
      return [{ unitId: nameToId[entry.target], amount: entry.amount, kind: 'heal' }];
    case 'shieldGranted':
      return [{ unitId: nameToId[entry.target], amount: entry.amount, kind: 'shield' }];
    case 'iceReflect':
      return [{ unitId: nameToId[entry.target], amount: entry.amount, kind: 'damage' }];
    case 'directDamage':
      return [{ unitId: nameToId[entry.target], amount: entry.amount, kind: 'damage' }];
    default:
      return [];
  }
}

function findCombatant(unitName: string, nameToId: Record<string, string>, allies: TurnCombatant[], enemies: TurnCombatant[]): TurnCombatant | undefined {
  const id = nameToId[unitName];
  return allies.find((c) => c.id === id) ?? enemies.find((c) => c.id === id);
}

function findAbilityById(unit: TurnCombatant, abilityId: string) {
  return (
    unit.activeAbilities.find((a) => a.id === abilityId) ??
    unit.benchAbilities.find((a) => a.id === abilityId) ??
    unit.passiveAbilities.find((a) => a.id === abilityId)
  );
}

let chatIdCounter = 0;
let floaterIdCounter = 0;
let abilityCastIdCounter = 0;
let attackAnimIdCounter = 0;

interface ReplayPlaybackState {
  log: TurnBattleLogEntry[];
  allies: TurnCombatant[];
  enemies: TurnCombatant[];
  allyIds: Set<string>;
  nameToId: Record<string, string>;
  replay: TurnReplayState;
  index: number;
  abilityLogFeed: ChatMessage[];
  floaters: FloatingText[];
  activeAbilities: AbilityCastEvent[];
  attackAnims: AttackAnimEvent[];
  finished: boolean;
  winner: 'allies' | 'enemies' | 'draw' | null;
  lastFullCastAt: number;
}

type Action =
  | { type: 'reset'; log: TurnBattleLogEntry[]; allies: TurnCombatant[]; enemies: TurnCombatant[]; nameToId: Record<string, string> }
  | { type: 'tick' }
  | { type: 'pruneFloaters' }
  | { type: 'pruneAbilities' }
  | { type: 'pruneAttackAnims' };

function buildFreshState(log: TurnBattleLogEntry[], allies: TurnCombatant[], enemies: TurnCombatant[], nameToId: Record<string, string>): ReplayPlaybackState {
  return {
    log,
    allies,
    enemies,
    allyIds: new Set(allies.map((u) => u.id)),
    nameToId,
    replay: createInitialTurnReplayState(allies, enemies),
    index: 0,
    abilityLogFeed: [],
    floaters: [],
    activeAbilities: [],
    attackAnims: [],
    finished: log.length === 0,
    winner: null,
    lastFullCastAt: 0,
  };
}

function castEventFrom(unit: TurnCombatant, abilityName: string, now: number, isAllySide: boolean): AbilityCastEvent {
  abilityCastIdCounter += 1;
  return {
    id: `turn-ability-cast-${abilityCastIdCounter}`,
    unitId: unit.id,
    unitName: unit.name,
    isAlly: isAllySide,
    abilityName,
    portraitUrl: DISPLAY_PORTRAIT_BY_TEMPLATE_ID[unit.templateId],
    createdAt: now,
  };
}

function withActiveAbility(list: AbilityCastEvent[], next: AbilityCastEvent): AbilityCastEvent[] {
  return [...list.filter((a) => a.isAlly !== next.isAlly), next];
}

function reducer(state: ReplayPlaybackState, action: Action): ReplayPlaybackState {
  if (action.type === 'reset') {
    return buildFreshState(action.log, action.allies, action.enemies, action.nameToId);
  }

  if (action.type === 'pruneFloaters') {
    const now = Date.now();
    const floaters = state.floaters.filter((f) => now - f.createdAt < FLOATER_LIFETIME_MS);
    return floaters.length === state.floaters.length ? state : { ...state, floaters };
  }

  if (action.type === 'pruneAbilities') {
    const now = Date.now();
    const activeAbilities = state.activeAbilities.filter((a) => now - a.createdAt < ABILITY_CAST_LIFETIME_MS);
    return activeAbilities.length === state.activeAbilities.length ? state : { ...state, activeAbilities };
  }

  if (action.type === 'pruneAttackAnims') {
    const now = Date.now();
    const attackAnims = state.attackAnims.filter((a) => now - a.createdAt < ATTACK_ANIM_LIFETIME_MS);
    return attackAnims.length === state.attackAnims.length ? state : { ...state, attackAnims };
  }

  // action.type === 'tick'
  if (state.finished || state.index >= state.log.length) {
    return state.finished ? state : { ...state, finished: true };
  }

  const entry = state.log[state.index];
  const replay = applyTurnReplayEntry(state.replay, entry, state.nameToId);
  const now = Date.now();

  let abilityLogFeed = state.abilityLogFeed;
  let activeAbilities = state.activeAbilities;
  let attackAnims = state.attackAnims;
  let lastFullCastAt = state.lastFullCastAt;

  const newFloaters = floatersFor(entry, state.nameToId)
    .filter((f) => f.unitId)
    .map((f) => {
      floaterIdCounter += 1;
      return { ...f, id: `turn-floater-${floaterIdCounter}`, createdAt: now };
    });

  if (entry.kind === 'abilityUsed') {
    const unit = findCombatant(entry.unit, state.nameToId, state.allies, state.enemies);
    if (unit) {
      const isAllySide = state.allyIds.has(unit.id);
      if (now - lastFullCastAt >= FULL_CAST_INTERVAL_MS) {
        activeAbilities = withActiveAbility(activeAbilities, castEventFrom(unit, entry.abilityName, now, isAllySide));
        lastFullCastAt = now;
      } else {
        floaterIdCounter += 1;
        newFloaters.push({ id: `turn-floater-${floaterIdCounter}`, unitId: unit.id, amount: 0, kind: 'ability', label: entry.abilityName, createdAt: now });
      }
      const ability = findAbilityById(unit, entry.abilityId);
      const effectText = ability ? describeAbilityEffect(ability) : '';
      chatIdCounter += 1;
      abilityLogFeed = [
        ...abilityLogFeed,
        {
          id: `turn-ability-log-${chatIdCounter}`,
          tab: 'log',
          text: `${entry.unit} usou ${entry.abilityName}${effectText ? ` - ${effectText}` : ''}`,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          tone: isAllySide ? 'success' : 'danger',
          logCategory: 'battle',
        },
      ];
    }
  } else if (entry.kind === 'attack') {
    const attacker = entry.result.attacker;
    attackAnimIdCounter += 1;
    attackAnims = [
      ...attackAnims,
      {
        id: `turn-attack-anim-${attackAnimIdCounter}`,
        attackerId: attacker.id,
        defenderId: entry.result.defender.id,
        isAllyAttacker: state.allyIds.has(attacker.id),
        tier: 'lightMelee',
        dodged: false,
        createdAt: now,
      },
    ];
  } else if (entry.kind === 'dodge') {
    const attackerId = state.nameToId[entry.attacker];
    const defenderId = state.nameToId[entry.defender];
    if (attackerId && defenderId) {
      attackAnimIdCounter += 1;
      attackAnims = [
        ...attackAnims,
        {
          id: `turn-attack-anim-${attackAnimIdCounter}`,
          attackerId,
          defenderId,
          isAllyAttacker: state.allyIds.has(attackerId),
          tier: 'lightMelee',
          dodged: true,
          createdAt: now,
        },
      ];
    }
  }

  const winner = entry.kind === 'battleEnd' ? entry.winner : state.winner;
  const index = state.index + 1;

  return {
    ...state,
    replay,
    index,
    abilityLogFeed,
    floaters: [...state.floaters, ...newFloaters],
    activeAbilities,
    attackAnims,
    winner,
    finished: index >= state.log.length,
    lastFullCastAt,
  };
}

export interface UseTurnBattleReplayOptions {
  log: TurnBattleLogEntry[];
  allies: TurnCombatant[];
  enemies: TurnCombatant[];
  nameToId: Record<string, string>;
  /** Bump this whenever log/allies/enemies represent a genuinely new battle — resets playback from t=0. */
  resetKey: string | number;
  playing: boolean;
  tickMs?: number;
  /** Fires once, the tick the battle's outcome becomes known. */
  onBattleEnd?: (winner: 'allies' | 'enemies' | 'draw') => void;
}

export interface TurnBattleReplay {
  replay: TurnReplayState;
  /** Only 'abilityUsed' lines — callers combine this with their own summary lines (rewards, win/loss). */
  abilityLogFeed: ChatMessage[];
  floaters: FloatingText[];
  activeAbilities: AbilityCastEvent[];
  attackAnims: AttackAnimEvent[];
  finished: boolean;
  winner: 'allies' | 'enemies' | 'draw' | null;
}

export function useTurnBattleReplay(options: UseTurnBattleReplayOptions): TurnBattleReplay {
  const { log, allies, enemies, nameToId, resetKey, playing, tickMs = 500, onBattleEnd } = options;
  const [reducerState, dispatch] = useReducer(reducer, undefined, () => buildFreshState(log, allies, enemies, nameToId));

  // See useBattleReplay.ts's identical comment: a new battle's allies/enemies must never be
  // rendered against the previous battle's stale replay snapshot, so the reset is computed
  // synchronously for this render rather than waiting a tick for the dispatched effect.
  const [trackedResetKey, setTrackedResetKey] = useState(resetKey);
  let state = reducerState;
  if (resetKey !== trackedResetKey) {
    setTrackedResetKey(resetKey);
    state = buildFreshState(log, allies, enemies, nameToId);
    dispatch({ type: 'reset', log, allies, enemies, nameToId });
  }

  useEffect(() => {
    if (!playing || state.finished) return;
    const id = setInterval(() => dispatch({ type: 'tick' }), tickMs);
    return () => clearInterval(id);
  }, [playing, state.finished, resetKey, tickMs]);

  useEffect(() => {
    if (state.floaters.length === 0) return;
    const id = setInterval(() => dispatch({ type: 'pruneFloaters' }), 250);
    return () => clearInterval(id);
  }, [state.floaters.length]);

  useEffect(() => {
    if (state.activeAbilities.length === 0) return;
    const id = setInterval(() => dispatch({ type: 'pruneAbilities' }), 250);
    return () => clearInterval(id);
  }, [state.activeAbilities.length]);

  useEffect(() => {
    if (state.attackAnims.length === 0) return;
    const id = setInterval(() => dispatch({ type: 'pruneAttackAnims' }), 150);
    return () => clearInterval(id);
  }, [state.attackAnims.length]);

  const winner = state.winner;
  useEffect(() => {
    if (winner) onBattleEnd?.(winner);
    // Fires once per resetKey when the winner first becomes known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner, resetKey]);

  return {
    replay: state.replay,
    abilityLogFeed: state.abilityLogFeed,
    floaters: state.floaters,
    activeAbilities: state.activeAbilities,
    attackAnims: state.attackAnims,
    finished: state.finished,
    winner: state.winner,
  };
}
