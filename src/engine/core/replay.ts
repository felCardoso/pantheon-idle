import type { BattleLogEntry, Combatant } from './types';

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
}

export interface ReplayState {
  round: number;
  /** Count of turn-spending actions (attack/dodge/stun-skip) taken since the last roundStart. */
  turnInRound: number;
  units: Record<string, UnitSnapshot>;
}

export function createInitialReplayState(allies: Combatant[], enemies: Combatant[]): ReplayState {
  const units: Record<string, UnitSnapshot> = {};
  for (const u of [...allies, ...enemies]) {
    units[u.id] = { id: u.id, hp: u.maxHp, maxHp: u.maxHp, shield: 0 };
  }
  return { round: 0, turnInRound: 0, units };
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
    case 'dodge':
      return { ...state, turnInRound: state.turnInRound + 1 };

    case 'attack': {
      const next = { ...state, turnInRound: state.turnInRound + 1 };
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

    case 'battleStart':
    case 'statusApplied':
    case 'statusExpired':
    case 'death':
    case 'battleEnd':
      return state;
  }
}
