// AUTO-GENERATED from src/engine — DO NOT EDIT BY HAND.
// Run `npm run sync:pvp-engine` after changing the engine.
// See scripts/sync-pvp-engine.mjs for why this copy exists.
import type { BattleLogEntry, Combatant } from './types.ts';
import type { StatusType } from '../schema.ts';

/**
 * Framework-agnostic playback layer: turns a finished battle's log into a
 * sequence of HP/shield/timestamp snapshots any UI can step through at its own
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
  /** Simulation clock in seconds, taken from the last applied entry's `at`. */
  now: number;
  units: Record<string, UnitSnapshot>;
  /**
   * Front-to-back queue order per side. Index 0 is the Vanguard — the only
   * unit that attacks or takes damage; the rest are the Bench. Unlike v2 there
   * is no rotation-per-exchange: a unit only leaves index 0 by being ejected
   * (`vanguardExit`), which drops it from the array entirely.
   */
  allyOrder: string[];
  enemyOrder: string[];
  /** Ids of the two current Vanguards, for the UI to know who to animate. */
  allyVanguardId: string | null;
  enemyVanguardId: string | null;
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
    now: 0,
    units,
    allyOrder: allies.map((u) => u.id),
    enemyOrder: enemies.map((u) => u.id),
    allyVanguardId: allies[0]?.id ?? null,
    enemyVanguardId: enemies[0]?.id ?? null,
  };
}

/** Drops an ejected Vanguard from whichever side's queue holds it. */
function dropFromQueue(state: ReplayState, id: string): ReplayState {
  if (state.allyOrder.includes(id)) {
    return { ...state, allyOrder: state.allyOrder.filter((u) => u !== id) };
  }
  if (state.enemyOrder.includes(id)) {
    return { ...state, enemyOrder: state.enemyOrder.filter((u) => u !== id) };
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
  // Every entry carries the clock, so a UI can drive playback on real time.
  const base = { ...state, now: entry.at };

  switch (entry.kind) {
    case 'vanguardEnter': {
      const id = nameToId[entry.unit];
      return entry.side === 'allies' ? { ...base, allyVanguardId: id } : { ...base, enemyVanguardId: id };
    }

    case 'vanguardExit': {
      const next = dropFromQueue(base, nameToId[entry.unit]);
      const replacementId = entry.replacedBy ? nameToId[entry.replacedBy] : null;
      return entry.side === 'allies'
        ? { ...next, allyVanguardId: replacementId }
        : { ...next, enemyVanguardId: replacementId };
    }

    case 'attack': {
      if (entry.result.dodged) return base;
      const id = entry.result.defender.id;
      const prev = base.units[id];
      if (!prev) return base;
      return withUnit(base, id, damage(prev, entry.result.hpDamage, entry.result.shieldAbsorbed));
    }

    case 'statusTick': {
      const id = nameToId[entry.target];
      const prev = base.units[id];
      if (!prev) return base;
      if (entry.tickKind === 'heal') {
        return withUnit(base, id, { hp: Math.min(prev.maxHp, prev.hp + entry.amount) });
      }
      return withUnit(base, id, damage(prev, entry.amount - entry.shieldAbsorbed, entry.shieldAbsorbed));
    }

    case 'heal': {
      const id = nameToId[entry.target];
      const prev = base.units[id];
      if (!prev) return base;
      return withUnit(base, id, { hp: Math.min(prev.maxHp, prev.hp + entry.amount) });
    }

    case 'moduleRevive': {
      // The unit never leaves the queue, so the snapshot only needs its HP back — the engine
      // already skipped the vanguardExit that would otherwise have ejected it.
      const id = nameToId[entry.unit];
      const prev = base.units[id];
      if (!prev) return base;
      return withUnit(base, id, { hp: Math.min(prev.maxHp, entry.hp) });
    }

    case 'moduleCleanse': {
      const id = nameToId[entry.unit];
      const prev = base.units[id];
      if (!prev) return base;
      const statuses = { ...prev.statuses };
      for (const status of entry.statuses) delete statuses[status];
      return withUnit(base, id, { statuses });
    }

    case 'shieldGranted': {
      const id = nameToId[entry.target];
      const prev = base.units[id];
      if (!prev) return base;
      return withUnit(base, id, { shield: prev.shield + entry.amount });
    }

    case 'iceReflect': {
      const id = nameToId[entry.target];
      const prev = base.units[id];
      if (!prev) return base;
      return withUnit(base, id, damage(prev, entry.hpDamage, entry.shieldAbsorbed));
    }

    case 'directDamage': {
      const id = nameToId[entry.target];
      const prev = base.units[id];
      if (!prev) return base;
      return withUnit(base, id, damage(prev, entry.hpDamage, entry.shieldAbsorbed));
    }

    case 'overload': {
      let next = base;
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
      const prev = base.units[id];
      if (!prev) return base;
      const current = prev.statuses[entry.status] ?? 0;
      const next = STACKABLE_STATUSES.has(entry.status) ? current + 1 : 1;
      return withUnit(base, id, { statuses: { ...prev.statuses, [entry.status]: next } });
    }

    case 'statusExpired': {
      const id = nameToId[entry.target];
      const prev = base.units[id];
      if (!prev) return base;
      const current = prev.statuses[entry.status] ?? 0;
      const next = Math.max(0, current - 1);
      const statuses = { ...prev.statuses };
      if (next <= 0) delete statuses[entry.status];
      else statuses[entry.status] = next;
      return withUnit(base, id, { statuses });
    }

    case 'battleStart':
    case 'attackBlockedStun':
    case 'dodge':
    case 'death':
    case 'battleEnd':
    case 'abilityUsed':
      return base;
  }
}
