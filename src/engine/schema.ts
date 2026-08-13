// Data-driven combat schema: characters, enemies and abilities are plain JSON
// (see src/engine/data/**) interpreted at runtime by the ability engine. Adding
// a new world/character/enemy means adding data, not code — see docs/mvp.md
// section 5 for the Gatilho x Efeito x Alvo design this mirrors.

export type Faction = 'Firewall' | 'Malware' | 'Crypto-Miner' | 'Exploit';

export type Element = 'Vírus' | 'Brute Force' | 'Nanites' | 'Encryption' | 'Backdoor';

export type Rarity = 'Alpha' | 'Beta' | 'RC' | 'Stable' | 'LTS' | 'Quantum';

export type StatusType =
  | 'virus'
  | 'sangramento'
  | 'veneno'
  | 'atordoamento'
  | 'enfraquecimento'
  | 'corrosao'
  | 'lentidao'
  | 'regeneracao'
  | 'marcado';

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  ini: number;
  esq: number; // fraction, e.g. 0.10 = 10%
}

/** How an effect's numeric strength is computed. */
export type Magnitude =
  | { kind: 'flat'; value: number }
  | { kind: 'percent'; value: number }
  | { kind: 'percentOfMaxHp'; percent: number }
  | { kind: 'percentOfBaseAtk'; basePercent: number; perStarBonus?: number }
  /** Reuses the damage value of the attack that caused this trigger (the general Vírus rule). */
  | { kind: 'triggeringDamage' };

export type TargetSelector = 'self' | 'attacker' | 'defender' | 'allEnemies' | 'allAllies';

export type AbilityTrigger = 'battleStart' | 'onAttack' | 'onDamaged' | 'onCriticalHit';

export interface ApplyStatusEffect {
  type: 'applyStatus';
  target: TargetSelector;
  status: StatusType;
  /** Round count, or "default" to use the standard duration table (constants.json). */
  duration: number | 'default';
  magnitude: Magnitude;
  ignoresDef?: boolean;
  ignoresShield?: boolean;
  stacks?: boolean;
}

export interface HealEffect {
  type: 'heal';
  target: TargetSelector;
  magnitude: Magnitude;
}

export interface GrantShieldEffect {
  type: 'grantShield';
  target: TargetSelector;
  magnitude: Magnitude;
}

export type AbilityEffect = ApplyStatusEffect | HealEffect | GrantShieldEffect;

export interface AbilityDefinition {
  id: string;
  name: string;
  trigger: AbilityTrigger;
  /** Probability in [0, 1] that the ability fires when its trigger fires. Omit for guaranteed (1). */
  chance?: number;
  effects: AbilityEffect[];
}

export interface CombatantData {
  id: string;
  name: string;
  faction: Faction | null;
  element: Element | null;
  rarity?: Rarity;
  mythology?: string;
  stars?: number;
  baseStats: BaseStats;
  abilities: string[];
  /** Jurupari.exe's passive: +N rounds to any status this unit applies. */
  statusDurationBonus?: number;
  /** Saci.exe's passive: this unit always acts before everyone else, every round. */
  alwaysActsFirst?: boolean;
}

export interface StatusDurationTable {
  virus: number;
  sangramento: number;
  veneno: number;
  enfraquecimento: number;
  corrosao: number;
  lentidao: number;
  atordoamento: number;
  regeneracao: number;
  /** "Até o próximo ataque recebido" — not round-based, null marks that. */
  marcado: null;
}

export interface CombatConstants {
  critChanceBase: number;
  critMultiplier: number;
  elementalAdvantageMultiplier: number;
  /** Map of attacker element -> element(s) it gets the advantage multiplier against. */
  elementalCounters: Partial<Record<Element, Element[]>>;
  statusDefaultDurations: StatusDurationTable;
  synergyByCount: Record<string, number>;
  antiInfiniteRound: {
    roundLimit: number;
    enrageStartRound: number;
    enrageBasePercent: number;
  };
}
