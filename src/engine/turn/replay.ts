import type { UnitSnapshot } from '../core/replay';
import type { StatusType } from '../schema';
import type { TurnBattleLogEntry, TurnCombatant } from './types';

/**
 * Turn-native counterpart to core/replay.ts's ReplayState/applyReplayEntry — steps a finished
 * turn battle's log into successive HP/shield/status snapshots a UI can play back on its own
 * clock, exactly like the real-time replay layer does for PvE/PvP-of-old. Deliberately simpler:
 * turn mode has no Vanguard/queue concept (every unit keeps its slot for the whole battle, dead
 * or not), so there is no order/vanguardId bookkeeping here — just `round` (the last applied
 * entry's `at`) and per-unit snapshots. Reuses core/replay.ts's UnitSnapshot shape (id/hp/maxHp/
 * shield/statuses) since it's exactly what a turn combatant needs too.
 */

export interface TurnReplayState {
  /** Round number of the last applied entry. */
  round: number;
  units: Record<string, UnitSnapshot>;
}

/** Statuses that stack into independent instances — mirrors core/replay.ts's STACKABLE_STATUSES. */
const STACKABLE_STATUSES: ReadonlySet<StatusType> = new Set(['leak']);

export function createInitialTurnReplayState(allies: TurnCombatant[], enemies: TurnCombatant[]): TurnReplayState {
  const units: Record<string, UnitSnapshot> = {};
  for (const u of [...allies, ...enemies]) {
    units[u.id] = { id: u.id, hp: u.maxHp, maxHp: u.maxHp, shield: 0, statuses: {} };
  }
  return { round: 0, units };
}

function withUnit(state: TurnReplayState, id: string, patch: Partial<UnitSnapshot>): TurnReplayState {
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
export function applyTurnReplayEntry(state: TurnReplayState, entry: TurnBattleLogEntry, nameToId: Record<string, string>): TurnReplayState {
  const base = { ...state, round: entry.at };

  switch (entry.kind) {
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
    case 'roundStart':
    case 'turnStart':
    case 'abilityUsed':
    case 'turnSkippedStun':
    case 'channelStart':
    case 'channelContinue':
    case 'channelResolved':
    case 'dodge':
    case 'death':
    case 'battleEnd':
      return base;
  }
}
