import type { BattleLogEntry, Combatant } from './types';
import type { StatusType } from '../schema';

/**
 * Framework-agnostic playback layer: turns a finished battle's log into a
 * sequence of HP/shield/round snapshots any UI can step through at its own
 * pace (the log itself carries every delta needed — see docs/mvp.md's
 * calibration for why each field exists, e.g. shieldAbsorbed on statusTick
 * so a Vírus tick replays the same shield-then-HP order as a real attack).
 */
export interface UnitSnapshot {
  id: string;
  hp: number;
  maxHp: number;
  shield: number;
  /** How many instances of each status are currently active, for badge display. */
  statuses: Partial<Record<StatusType, number>>;
}

export interface ReplayState {
  round: number;
  /** Count of turn-spending actions (attack/dodge/stun-skip) taken since the last roundStart. */
  turnInRound: number;
  units: Record<string, UnitSnapshot>;
  /**
   * Front-to-back queue order per side, for the "front of the line" formation
   * display: whoever just spent a turn (attack/dodge/stun-skip) rotates to the
   * back, so the next unit due to act is always shown at the front.
   */
  allyOrder: string[];
  enemyOrder: string[];
}

/**
 * Statuses that stack into independent instances (docs/combate.md: Sangramento
 * is explicitly stackable). Everything else replaces its existing instance in
 * place, so a re-application should reset the visible count to 1 rather than
 * accumulate — otherwise repeated non-stacking applies (e.g. Lentidão reapplied
 * every round) would drift upward, since a replace never logs a matching expiry
 * for the instance it replaced.
 */
const STACKABLE_STATUSES: ReadonlySet<StatusType> = new Set(['sangramento']);

export function createInitialReplayState(allies: Combatant[], enemies: Combatant[]): ReplayState {
  const units: Record<string, UnitSnapshot> = {};
  for (const u of [...allies, ...enemies]) {
    units[u.id] = { id: u.id, hp: u.maxHp, maxHp: u.maxHp, shield: 0, statuses: {} };
  }
  return {
    round: 0,
    turnInRound: 0,
    units,
    allyOrder: allies.map((u) => u.id),
    enemyOrder: enemies.map((u) => u.id),
  };
}

/** Moves `id` to the back of whichever side's order array currently holds it — the unit that just acted cedes the front. */
function rotateToBack(state: ReplayState, id: string): ReplayState {
  if (state.allyOrder.includes(id)) {
    return { ...state, allyOrder: [...state.allyOrder.filter((u) => u !== id), id] };
  }
  if (state.enemyOrder.includes(id)) {
    return { ...state, enemyOrder: [...state.enemyOrder.filter((u) => u !== id), id] };
  }
  return state;
}

/** Log entries identify units by display name, which is unique within one battle instance. */
export function buildNameToId(allies: Combatant[], enemies: Combatant[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const u of [...allies, ...enemies]) map[u.name] = u.id;
  return map;
}

function withUnit(state: ReplayState, id: string, patch: Partial<UnitSnapshot>): ReplayState {
  const prev = state.units[id];
  if (!prev) return state;
  return { ...state, units: { ...state.units, [id]: { ...prev, ...patch } } };
}

function damage(prev: UnitSnapshot, hpDamage: number, shieldAbsorbed: number): Partial<UnitSnapshot> {
  return {
    shield: Math.max(0, prev.shield - shieldAbsorbed),
    hp: Math.max(0, prev.hp - hpDamage),
  };
}

/** Applies one log entry on top of a snapshot, returning the next snapshot. Pure — safe to step forward or replay from scratch. */
export function applyReplayEntry(state: ReplayState, entry: BattleLogEntry, nameToId: Record<string, string>): ReplayState {
  switch (entry.kind) {
    case 'roundStart':
      return { ...state, round: entry.round, turnInRound: 0 };

    case 'turnSkippedStun':
      return rotateToBack({ ...state, turnInRound: state.turnInRound + 1 }, nameToId[entry.unit]);

    case 'dodge':
      return rotateToBack({ ...state, turnInRound: state.turnInRound + 1 }, nameToId[entry.attacker]);

    case 'attack': {
      const next = rotateToBack({ ...state, turnInRound: state.turnInRound + 1 }, entry.result.attacker.id);
      if (entry.result.dodged) return next;
      const id = entry.result.defender.id;
      const prev = state.units[id];
      return withUnit(next, id, damage(prev, entry.result.hpDamage, entry.result.shieldAbsorbed));
    }

    case 'statusTick': {
      const id = nameToId[entry.target];
      const prev = state.units[id];
      if (!prev) return state;
      if (entry.tickKind === 'heal') {
        return withUnit(state, id, { hp: Math.min(prev.maxHp, prev.hp + entry.amount) });
      }
      return withUnit(state, id, damage(prev, entry.amount - entry.shieldAbsorbed, entry.shieldAbsorbed));
    }

    case 'heal': {
      const id = nameToId[entry.target];
      const prev = state.units[id];
      if (!prev) return state;
      return withUnit(state, id, { hp: Math.min(prev.maxHp, prev.hp + entry.amount) });
    }

    case 'shieldGranted': {
      const id = nameToId[entry.target];
      const prev = state.units[id];
      if (!prev) return state;
      return withUnit(state, id, { shield: prev.shield + entry.amount });
    }

    case 'iceReflect': {
      const id = nameToId[entry.target];
      const prev = state.units[id];
      if (!prev) return state;
      return withUnit(state, id, damage(prev, entry.hpDamage, entry.shieldAbsorbed));
    }

    case 'enrage': {
      let next = state;
      for (const d of entry.damages) {
        const id = nameToId[d.target];
        const prev = next.units[id];
        if (!prev) continue;
        next = withUnit(next, id, { hp: Math.max(0, prev.hp - d.amount) });
      }
      return next;
    }

    case 'statusApplied': {
      const id = nameToId[entry.target];
      const prev = state.units[id];
      if (!prev) return state;
      const current = prev.statuses[entry.status] ?? 0;
      const next = STACKABLE_STATUSES.has(entry.status) ? current + 1 : 1;
      return withUnit(state, id, { statuses: { ...prev.statuses, [entry.status]: next } });
    }

    case 'statusExpired': {
      const id = nameToId[entry.target];
      const prev = state.units[id];
      if (!prev) return state;
      const current = prev.statuses[entry.status] ?? 0;
      const next = Math.max(0, current - 1);
      const statuses = { ...prev.statuses };
      if (next <= 0) delete statuses[entry.status];
      else statuses[entry.status] = next;
      return withUnit(state, id, { statuses });
    }

    case 'battleStart':
    case 'death':
    case 'battleEnd':
      return state;
  }
}
