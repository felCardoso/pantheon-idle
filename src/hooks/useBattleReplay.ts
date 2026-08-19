import { useEffect, useReducer, useState } from 'react';
import { applyReplayEntry, type BattleLogEntry, type Combatant, type ReplayState } from '../engine';
import { DISPLAY_PORTRAIT_BY_TEMPLATE_ID } from '../data/engineDisplay';
import { describeAbilityEffect } from '../data/abilityDescriptions';
import type { ChatMessage } from '../types';

/**
 * Steps a finished battle's log forward on a real interval, turning it into
 * everything a battle view needs to animate: HP/shield/status snapshots (via
 * the engine's own replay layer), floating damage numbers, ability-cast
 * callouts and speed-tiered attack animations. Shared by PvE
 * (useBattleSimulation, which wraps this with world progression/rewards on
 * top) and PvP (which has no progression concerns — just plays one log and
 * reports the result) so the two never carry two copies of this logic.
 */

export type FloatingTextKind = 'damage' | 'crit' | 'heal' | 'shield' | 'ability';

export interface FloatingText {
  id: string;
  unitId: string;
  amount: number;
  kind: FloatingTextKind;
  createdAt: number;
  /** Set instead of `amount` for the 'ability' kind — the ability's name, shown above the caster. */
  label?: string;
}

/** How long a floating number stays on screen before being pruned. */
const FLOATER_LIFETIME_MS = 1100;

/** The full-screen "ability cast" callout (darken + sliding name + caster portrait) triggered by a BattleLogEntry's 'abilityUsed' kind — see abilityEngine.ts's fireTrigger. Keyed per side (ally/enemy) so both can be visible at once — that's what makes a simultaneous cast read as a "clash". */
export interface AbilityCastEvent {
  id: string;
  unitId: string;
  unitName: string;
  isAlly: boolean;
  abilityName: string;
  portraitUrl?: string;
  createdAt: number;
}

/** How long the ability-cast callout stays on screen before being pruned — matches index.css's ability-cast-* keyframe durations. */
const ABILITY_CAST_LIFETIME_MS = 1800;

/**
 * Which basic-attack animation to play, keyed off the real gap (in simulation
 * seconds) since that same attacker's previous attack — docs request: 0.2-0.5s
 * is too fast to lunge for every hit (fires a projectile instead), 0.6-1.5s
 * can afford a short step-in (and still shoot), anything slower reads as one
 * heavy, deliberate strike. The very first attack of the battle has no prior
 * interval to compare against, so it defaults to the light-melee tier.
 */
export type AttackAnimTier = 'ranged' | 'lightMelee' | 'heavyMelee';

export interface AttackAnimEvent {
  id: string;
  attackerId: string;
  defenderId: string;
  isAllyAttacker: boolean;
  tier: AttackAnimTier;
  /** No impact flash on the defender when the hit was dodged. */
  dodged: boolean;
  createdAt: number;
}

const ATTACK_ANIM_LIFETIME_MS: Record<AttackAnimTier, number> = {
  ranged: 500,
  lightMelee: 480,
  heavyMelee: 700,
};

function attackTierFor(intervalSeconds: number | null): AttackAnimTier {
  if (intervalSeconds === null) return 'lightMelee';
  if (intervalSeconds <= 0.5) return 'ranged';
  if (intervalSeconds <= 1.5) return 'lightMelee';
  return 'heavyMelee';
}

/** If no animation has been visible on screen for this long, the next Vanguard to attack forces its equipped ability's cast callout as a flourish — keeps a slow-cadence fight from ever reading as frozen. */
const IDLE_WATCHDOG_MS = 10_000;

/**
 * Minimum gap between two full-screen cast callouts. Abilities fire far more often than this in
 * a busy fight, and dimming the screen for every one of them buries the battle it is meant to
 * punctuate. Casts inside the gap still show — as an 'ability' floater naming the ability over
 * the caster's card, which reads at a glance without taking the screen over.
 */
const FULL_CAST_INTERVAL_MS = 10_000;

/** What floating numbers (if any) a log entry should spawn, keyed by target unit id. */
function floatersFor(entry: BattleLogEntry, nameToId: Record<string, string>): Omit<FloatingText, 'id' | 'createdAt'>[] {
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
    case 'overload':
      return entry.damages.map((d) => ({ unitId: nameToId[d.target], amount: d.amount, kind: 'damage' as const }));
    default:
      return [];
  }
}

function findCombatant(unitName: string, nameToId: Record<string, string>, allies: Combatant[], enemies: Combatant[]): Combatant | undefined {
  const id = nameToId[unitName];
  return allies.find((c) => c.id === id) ?? enemies.find((c) => c.id === id);
}

function findAbilityById(unit: Combatant, abilityId: string) {
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
  log: BattleLogEntry[];
  allies: Combatant[];
  enemies: Combatant[];
  /**
   * Which unit ids came from the `allies` array — the real screen-side signal. A Combatant's own
   * `.isAlly` field is an engine build-rule flag (player-character stat/ability rules), not a
   * side: it stays true for a PvP *defender* too, since defenders are built the exact same way an
   * attacker's own roster is (see src/data/battleUnits.ts's doc comment on the same distinction).
   */
  allyIds: Set<string>;
  nameToId: Record<string, string>;
  replay: ReplayState;
  index: number;
  abilityLogFeed: ChatMessage[];
  floaters: FloatingText[];
  /** At most one per side — a concurrent ally + enemy cast is what renders as a clash. */
  activeAbilities: AbilityCastEvent[];
  attackAnims: AttackAnimEvent[];
  finished: boolean;
  winner: 'allies' | 'enemies' | 'draw' | null;
  /** Simulation-clock `at` of each unit's most recent attack, for tiering the next one. */
  lastAttackAtByUnit: Record<string, number>;
  /** Wall-clock ms of the last tick that produced a visible animation — drives the idle watchdog. */
  lastVisibleAnimAt: number;
  /** Which side(s) are owed a forced cast callout on their Vanguard's next attack, per the idle watchdog. */
  forcedCastSides: { allies: boolean; enemies: boolean };
  /** Wall-clock ms of the last full-screen cast callout — gates the next one, see FULL_CAST_INTERVAL_MS. */
  lastFullCastAt: number;
}

type Action = { type: 'reset'; log: BattleLogEntry[]; allies: Combatant[]; enemies: Combatant[]; nameToId: Record<string, string> } | { type: 'tick' } | { type: 'pruneFloaters' } | { type: 'pruneAbilities' } | { type: 'pruneAttackAnims' };

/**
 * A brand-new battle's starting state — used both by the reducer's 'reset' action (for ticks
 * still in flight) and synchronously in the hook body itself (see useBattleReplay's resetKey
 * handling) so a battle transition never renders one battle's allies/enemies against another
 * battle's replay.allyOrder/enemyOrder, which — since they're unit ids — would otherwise throw
 * trying to look up a unit that doesn't exist in the new roster.
 */
function buildFreshState(log: BattleLogEntry[], allies: Combatant[], enemies: Combatant[], nameToId: Record<string, string>): ReplayPlaybackState {
  const units: ReplayState['units'] = {};
  for (const u of [...allies, ...enemies]) units[u.id] = { id: u.id, hp: u.maxHp, maxHp: u.maxHp, shield: 0, statuses: {} };
  return {
    log,
    allies,
    enemies,
    allyIds: new Set(allies.map((u) => u.id)),
    nameToId,
    replay: {
      now: 0,
      units,
      allyOrder: allies.map((u) => u.id),
      enemyOrder: enemies.map((u) => u.id),
      allyVanguardId: allies[0]?.id ?? null,
      enemyVanguardId: enemies[0]?.id ?? null,
    },
    index: 0,
    abilityLogFeed: [],
    floaters: [],
    activeAbilities: [],
    attackAnims: [],
    finished: log.length === 0,
    winner: null,
    lastAttackAtByUnit: {},
    lastVisibleAnimAt: Date.now(),
    forcedCastSides: { allies: false, enemies: false },
    // 0 rather than Date.now() so the battle's first ability still gets the full callout.
    lastFullCastAt: 0,
  };
}

function castEventFrom(unit: Combatant, abilityName: string, now: number, isAllySide: boolean): AbilityCastEvent {
  abilityCastIdCounter += 1;
  return {
    id: `ability-cast-${abilityCastIdCounter}`,
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
    const attackAnims = state.attackAnims.filter((a) => now - a.createdAt < ATTACK_ANIM_LIFETIME_MS[a.tier]);
    return attackAnims.length === state.attackAnims.length ? state : { ...state, attackAnims };
  }

  // action.type === 'tick'
  if (state.finished || state.index >= state.log.length) {
    return state.finished ? state : { ...state, finished: true };
  }

  const entry = state.log[state.index];
  const replay = applyReplayEntry(state.replay, entry, state.nameToId);
  const now = Date.now();
  const idleTripped = now - state.lastVisibleAnimAt >= IDLE_WATCHDOG_MS;
  let forcedCastSides = {
    allies: state.forcedCastSides.allies || idleTripped,
    enemies: state.forcedCastSides.enemies || idleTripped,
  };

  let abilityLogFeed = state.abilityLogFeed;
  let activeAbilities = state.activeAbilities;
  let attackAnims = state.attackAnims;
  let lastAttackAtByUnit = state.lastAttackAtByUnit;
  let lastFullCastAt = state.lastFullCastAt;
  let visibleAnimation = false;

  const newFloaters = floatersFor(entry, state.nameToId)
    .filter((f) => f.unitId)
    .map((f) => {
      floaterIdCounter += 1;
      return { ...f, id: `floater-${floaterIdCounter}`, createdAt: now };
    });
  if (newFloaters.length > 0) visibleAnimation = true;

  if (entry.kind === 'abilityUsed') {
    const unit = findCombatant(entry.unit, state.nameToId, state.allies, state.enemies);
    if (unit) {
      const isAllySide = state.allyIds.has(unit.id);
      // Only one cast in every FULL_CAST_INTERVAL_MS earns the screen-dimming callout; the rest
      // are announced by a floating ability name over the caster instead.
      if (now - lastFullCastAt >= FULL_CAST_INTERVAL_MS) {
        const castEvent = castEventFrom(unit, entry.abilityName, now, isAllySide);
        activeAbilities = withActiveAbility(activeAbilities, castEvent);
        lastFullCastAt = now;
      } else {
        floaterIdCounter += 1;
        newFloaters.push({
          id: `floater-${floaterIdCounter}`,
          unitId: unit.id,
          amount: 0,
          kind: 'ability',
          label: entry.abilityName,
          createdAt: now,
        });
      }
      forcedCastSides = { ...forcedCastSides, [isAllySide ? 'allies' : 'enemies']: false };
      visibleAnimation = true;
      const ability = findAbilityById(unit, entry.abilityId);
      const effectText = ability ? describeAbilityEffect(ability) : '';
      chatIdCounter += 1;
      abilityLogFeed = [
        ...abilityLogFeed,
        {
          id: `ability-log-${chatIdCounter}`,
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
    const isAllySide = state.allyIds.has(attacker.id);
    const side: 'allies' | 'enemies' = isAllySide ? 'allies' : 'enemies';
    const prevAt = state.lastAttackAtByUnit[attacker.id] ?? null;
    const interval = prevAt !== null ? entry.at - prevAt : null;
    const tier = attackTierFor(interval);
    lastAttackAtByUnit = { ...lastAttackAtByUnit, [attacker.id]: entry.at };
    attackAnimIdCounter += 1;
    attackAnims = [
      ...attackAnims,
      {
        id: `attack-anim-${attackAnimIdCounter}`,
        attackerId: attacker.id,
        defenderId: entry.result.defender.id,
        isAllyAttacker: isAllySide,
        tier,
        dodged: entry.result.dodged,
        createdAt: now,
      },
    ];
    visibleAnimation = true;

    if (forcedCastSides[side]) {
      const flourish = attacker.activeAbilities[0];
      if (flourish) {
        // The watchdog only trips after IDLE_WATCHDOG_MS of nothing, which is the same gap the
        // full callout is throttled to, so this never fights FULL_CAST_INTERVAL_MS — but it does
        // count as one, so a real cast right after doesn't immediately dim the screen again.
        activeAbilities = withActiveAbility(activeAbilities, castEventFrom(attacker, flourish.name, now, isAllySide));
        lastFullCastAt = now;
      }
      forcedCastSides = { ...forcedCastSides, [side]: false };
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
    lastAttackAtByUnit,
    lastVisibleAnimAt: visibleAnimation ? now : state.lastVisibleAnimAt,
    forcedCastSides,
    lastFullCastAt,
  };
}

export interface UseBattleReplayOptions {
  log: BattleLogEntry[];
  allies: Combatant[];
  enemies: Combatant[];
  nameToId: Record<string, string>;
  /** Bump this whenever log/allies/enemies represent a genuinely new battle — resets playback from t=0. */
  resetKey: string | number;
  playing: boolean;
  tickMs?: number;
  /** Fires once, the tick the battle's outcome becomes known. */
  onBattleEnd?: (winner: 'allies' | 'enemies' | 'draw') => void;
}

export interface BattleReplay {
  replay: ReplayState;
  /** Only 'abilityUsed' lines ("<Nome> usou <Habilidade> - <efeito>") — callers combine this with their own summary lines (rewards, win/loss). */
  abilityLogFeed: ChatMessage[];
  floaters: FloatingText[];
  /** At most one per side. */
  activeAbilities: AbilityCastEvent[];
  attackAnims: AttackAnimEvent[];
  finished: boolean;
  winner: 'allies' | 'enemies' | 'draw' | null;
}

export function useBattleReplay(options: UseBattleReplayOptions): BattleReplay {
  const { log, allies, enemies, nameToId, resetKey, playing, tickMs = 500, onBattleEnd } = options;
  const [reducerState, dispatch] = useReducer(reducer, undefined, () => buildFreshState(log, allies, enemies, nameToId));

  // A new battle's allies/enemies must never be rendered against the PREVIOUS battle's
  // replay.allyOrder/enemyOrder (unit ids from the old roster) — that's a dangling-id crash
  // waiting to happen (toBattleUnits looks each order id up in the new roster and finds
  // nothing). dispatching the reset in an effect is one render too late for that: this render
  // would still pair new allies/enemies with reducerState's stale replay. Track resetKey and,
  // the moment it changes, compute this render's state synchronously (React's documented
  // pattern for "resetting state when a prop changes") — the dispatch below still runs so the
  // reducer itself catches up before the next tick.
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
