import type { BattleLogEntry, Combatant } from './types';
import type { StatusType } from '../schema';

/**
 * Framework-agnostic playback layer: turns a finished battle's log into a
 * sequence of HP/shield/round snapshots any UI can step through at its own
 * pace (the log itself carries every delta needed).
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
  units: Record<string, UnitSnapshot>;
  /**
   * Front-to-back line-up/queue order per side (front = index 0) — the two
   * front units are this round's clash participants; on `clashEnd` the
   * survivor rotates to the back of its own side and the dead one is
   * dropped entirely, mirroring battle.ts's own queue rotation.
   */
  allyOrder: string[];
  enemyOrder: string[];
}

/**
 * Statuses that stack into independent instances (docs/combate.md: Leak
 * is explicitly stackable). Everything else replaces its existing instance in
 * place, so a re-application should reset the visible count to 1 rather than
 * accumulate — otherwise repeated non-stacking applies (e.g. Lag reapplied
 * every round) would drift upward, since a replace never logs a matching expiry
 * for the instance it replaced.
 */
const STACKABLE_STATUSES: ReadonlySet<StatusType> = new Set(['leak']);

export function createInitialReplayState(allies: Combatant[], enemies: Combatant[]): ReplayState {
  const units: Record<string, UnitSnapshot> = {};
  for (const u of [...allies, ...enemies]) {
    units[u.id] = { id: u.id, hp: u.maxHp, maxHp: u.maxHp, shield: 0, statuses: {} };
  }
  return {
    round: 0,
    units,
    allyOrder: allies.map((u) => u.id),
    enemyOrder: enemies.map((u) => u.id),
  };
}

/** Rotates `id` to the back of whichever side's order array currently holds it if it's still alive, or drops it entirely if it died this clash. */
function rotateOrDrop(state: ReplayState, id: string): ReplayState {
  const alive = (state.units[id]?.hp ?? 0) > 0;
  if (state.allyOrder.includes(id)) {
    const rest = state.allyOrder.filter((u) => u !== id);
    return { ...state, allyOrder: alive ? [...rest, id] : rest };
  }
  if (state.enemyOrder.includes(id)) {
    const rest = state.enemyOrder.filter((u) => u !== id);
    return { ...state, enemyOrder: alive ? [...rest, id] : rest };
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
    case 'clashStart':
      return { ...state, round: entry.round };

    case 'clashEnd': {
      let next = rotateOrDrop(state, nameToId[entry.allyUnit]);
      next = rotateOrDrop(next, nameToId[entry.enemyUnit]);
      return next;
    }

    case 'attack': {
      if (entry.result.dodged) return state;
      const id = entry.result.defender.id;
      const prev = state.units[id];
      if (!prev) return state;
      return withUnit(state, id, damage(prev, entry.result.hpDamage, entry.result.shieldAbsorbed));
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

    case 'directDamage': {
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
    case 'turnSkippedStun':
    case 'dodge':
    case 'actionCancelled':
    case 'pingAdvantage':
    case 'death':
    case 'battleEnd':
      return state;
  }
}
