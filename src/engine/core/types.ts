import type { AbilityDefinition, BaseStats, Element, Faction, StatusType } from '../schema';

export interface StatusEffectInstance {
  status: StatusType;
  /** Rounds left before this expires; null = consumed on next hit taken (Marcado), not round-based. */
  remainingRounds: number | null;
  /**
   * Meaning depends on status: flat HP delta per round for DOT/regen statuses,
   * percent reduction for attribute debuffs (enfraquecimento/lentidao/corrosao).
   * Unused for atordoamento/marcado (presence is all that matters).
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
  element: Element | null;
  isAlly: boolean;
  stars: number;
  /** Effective base stats for this battle (synergy bonus already folded in for allies). */
  base: BaseStats;
  maxHp: number;
  hp: number;
  shield: number;
  statuses: StatusEffectInstance[];
  abilities: AbilityDefinition[];
  statusDurationBonus: number;
  alwaysActsFirst: boolean;
}

export function isAlive(c: Combatant): boolean {
  return c.hp > 0;
}

export interface AttackResult {
  attacker: Combatant;
  defender: Combatant;
  dodged: boolean;
  crit: boolean;
  elementalAdvantage: boolean;
  rawDamage: number;
  finalDamage: number;
  shieldAbsorbed: number;
  hpDamage: number;
  defenderDied: boolean;
}

export type BattleLogEntry =
  | { kind: 'battleStart' }
  | { kind: 'roundStart'; round: number }
  | { kind: 'turnSkippedStun'; unit: string }
  | { kind: 'attack'; result: AttackResult }
  | { kind: 'dodge'; attacker: string; defender: string }
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
  | { kind: 'death'; unit: string }
  | { kind: 'enrage'; round: number; percent: number; damages: { target: string; amount: number }[] }
  | { kind: 'battleEnd'; winner: 'allies' | 'enemies' | 'draw'; reason: 'elimination' | 'roundLimit' };
