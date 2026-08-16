import type { AbilityDefinition, BaseStats, Faction, StatusType } from '../schema';

export interface StatusEffectInstance {
  status: StatusType;
  /** Rounds left before this expires; null = consumed on next hit taken (Target) or lasts the rest of the battle (permanent buffs) — never ages down on its own either way. */
  remainingRounds: number | null;
  /**
   * Meaning depends on status: flat HP delta per round for DOT/regen
   * statuses, percent reduction for Throttling/Lag, percent bonus/malus for
   * the generic buffAtk/buffDef/buffIni/buffEsq/buffIce statuses (negative
   * value = a debuff, e.g. a Firewall-reduction effect). Unused for
   * crash/target (presence is all that matters).
   */
  value: number;
  ignoresShield?: boolean;
}

export interface Combatant {
  /** Unique within this battle instance (templateId, or templateId#n for repeated enemies). */
  id: string;
  templateId: string;
  name: string;
  faction: Faction | null;
  isAlly: boolean;
  stars: number;
  /** Derived from accumulated XP (see engine/core/leveling.ts); 0 for enemies. */
  level: number;
  /** Effective base stats for this battle (synergy bonus already folded in for allies). */
  base: BaseStats;
  maxHp: number;
  hp: number;
  shield: number;
  statuses: StatusEffectInstance[];
  abilities: AbilityDefinition[];
  statusDurationBonus: number;
  alwaysActsFirst: boolean;
  /** Whether this unit has already fired its onHalfHp trigger this battle — fires once, the first time HP crosses below 50% max, never re-fires on a later heal-then-redrop. */
  halfHpTriggered: boolean;
}

export function isAlive(c: Combatant): boolean {
  return c.hp > 0;
}

export interface AttackResult {
  attacker: Combatant;
  defender: Combatant;
  dodged: boolean;
  crit: boolean;
  rawDamage: number;
  finalDamage: number;
  shieldAbsorbed: number;
  hpDamage: number;
  defenderDied: boolean;
}

export type BattleLogEntry =
  | { kind: 'battleStart' }
  /** One clashStart = one line-up clash (front-of-queue vs front-of-queue) — "round" now means "clash," not "every unit's turn." */
  | { kind: 'clashStart'; round: number }
  /** An active ability (kind: 'active') actually fired — passed its trigger and chance roll. Passives don't log this; they're not a "cast" moment worth a UI callout. */
  | { kind: 'abilityUsed'; unit: string; abilityId: string; abilityName: string }
  | { kind: 'turnSkippedStun'; unit: string }
  | { kind: 'attack'; result: AttackResult }
  | { kind: 'dodge'; attacker: string; defender: string }
  /** The lower-Ping clash participant's attack was skipped because the higher-Ping one's attack ejected it first. */
  | { kind: 'actionCancelled'; unit: string }
  /** Fires when a clash's priority is decided by a real Ping (INI) difference (not alwaysActsFirst, not a tie). */
  | { kind: 'pingAdvantage'; unit: string }
  /** Marks a clash as fully resolved — the two line-up participants that round, for replay to requeue (survivor to back, dead one dropped). */
  | { kind: 'clashEnd'; allyUnit: string; enemyUnit: string }
  | { kind: 'statusApplied'; target: string; status: StatusType; source: string; rounds: number | null }
  | {
      kind: 'statusTick';
      target: string;
      status: StatusType;
      amount: number;
      tickKind: 'damage' | 'heal';
      shieldAbsorbed: number;
    }
  | { kind: 'statusExpired'; target: string; status: StatusType }
  | { kind: 'heal'; target: string; amount: number; source: string }
  | { kind: 'shieldGranted'; target: string; amount: number; source: string }
  | { kind: 'directDamage'; target: string; source: string; amount: number; shieldAbsorbed: number; hpDamage: number; targetDied: boolean }
  /** ICE reflection: `source` is the defender whose ICE fired, `target` is the original attacker taking it back. */
  | { kind: 'iceReflect'; source: string; target: string; amount: number; shieldAbsorbed: number; hpDamage: number; targetDied: boolean }
  | { kind: 'death'; unit: string }
  | { kind: 'enrage'; round: number; percent: number; damages: { target: string; amount: number }[] }
  | { kind: 'battleEnd'; winner: 'allies' | 'enemies' | 'draw'; reason: 'elimination' | 'roundLimit' };
