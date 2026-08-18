import type { AbilityDefinition, BaseStats, Faction, StatusType } from '../schema';

export interface StatusEffectInstance {
  status: StatusType;
  /**
   * Seconds left before this expires; null = consumed on next hit taken
   * (Target) or lasts the rest of the battle (permanent buffs) — never ages
   * down on its own either way.
   */
  remainingSeconds: number | null;
  /**
   * Meaning depends on status: HP delta PER SECOND for DOT/regen statuses,
   * percent reduction for Throttling/Lag, percent bonus/malus for the generic
   * buffAtk/buffDef/buffVel/buffEsq/buffIce statuses (negative value = a
   * debuff, e.g. Corrosão is a negative buffDef). Unused for crash/target
   * (presence is all that matters).
   */
  value: number;
  ignoresShield?: boolean;
  /**
   * Set for statuses attached by a bench ability, naming the benched owner.
   * When that owner rotates into the Vanguard (or is ejected) the engine
   * detaches every status carrying its id — this is what makes bench buffs
   * "apenas enquanto o dono estiver inativo" (docs/combate.md v3.1 §1).
   */
  benchSourceId?: string;
  /** Fractional-second accumulator for per-second ticks; internal to the status manager. */
  tickAccumulator?: number;
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
  /** Fires only while this unit is the Vanguard. */
  activeAbilities: AbilityDefinition[];
  /** Fires only while this unit is benched. */
  benchAbilities: AbilityDefinition[];
  /** Always on, regardless of position. */
  passiveAbilities: AbilityDefinition[];
  statusDurationBonus: number;
  /** Whether this unit has already fired its onHalfHp trigger this battle — fires once, the first time HP crosses below 50% max, never re-fires on a later heal-then-redrop. */
  halfHpTriggered: boolean;
  /** Seconds until this unit's next basic attack. Only ticks down while it is the Vanguard. */
  attackCooldownRemaining: number;
  /** Seconds until each cooldown-driven ability may fire again, keyed by ability id. */
  abilityCooldownRemaining: Record<string, number>;
  /** True while this unit is its side's index-0 Vanguard. */
  isVanguard: boolean;
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

/**
 * Every entry carries `at`, the simulation timestamp in seconds, so the UI can
 * replay the battle on a real clock instead of stepping an abstract index.
 */
export type BattleLogEntry = { at: number } & (
  | { kind: 'battleStart' }
  /** A unit rotated into the front. Emitted at t=0 for the opening pair too. */
  | { kind: 'vanguardEnter'; unit: string; side: 'allies' | 'enemies' }
  /** The Vanguard was ejected; `replacedBy` is null when that side has nobody left. */
  | { kind: 'vanguardExit'; unit: string; side: 'allies' | 'enemies'; replacedBy: string | null }
  /** An active/bench ability actually fired — passed its trigger, cooldown and chance roll. */
  | { kind: 'abilityUsed'; unit: string; abilityId: string; abilityName: string; scope: 'active' | 'bench' | 'passive' }
  /** A basic attack was suppressed because the unit is under Crash (stun). */
  | { kind: 'attackBlockedStun'; unit: string }
  | { kind: 'attack'; result: AttackResult }
  | { kind: 'dodge'; attacker: string; defender: string }
  | { kind: 'statusApplied'; target: string; status: StatusType; source: string; seconds: number | null }
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
  /** System Overload tick (docs/combate.md v3.1 §6). */
  | { kind: 'overload'; percent: number; damages: { target: string; amount: number }[] }
  | { kind: 'battleEnd'; winner: 'allies' | 'enemies' | 'draw'; reason: 'elimination' | 'timeLimit' }
);
