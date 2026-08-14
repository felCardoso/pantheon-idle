// Data-driven combat schema: characters, enemies and abilities are plain JSON
// (see src/engine/data/**) interpreted at runtime by the ability engine. Adding
// a new world/character/enemy means adding data, not code — see docs/mvp.md
// section 5 for the Gatilho x Efeito x Alvo design this mirrors.

export type Faction = 'Firewall' | 'Malware' | 'Crypto-Miner' | 'Exploit';

export type Element = 'Vírus' | 'Brute Force' | 'Nanites' | 'Encryption' | 'Backdoor';

export type Rarity = 'Alpha' | 'Beta' | 'Stable' | 'LTS' | 'Zero-Day';

export type StatusType =
  | 'virus'
  | 'sangramento'
  | 'veneno'
  | 'atordoamento'
  | 'enfraquecimento'
  | 'corrosao'
  | 'lentidao'
  | 'regeneracao'
  | 'marcado'
  | 'buffAtk'
  | 'buffDef'
  | 'buffIni'
  | 'buffEsq';

/**
 * HP/ATK are the only stats that grow generically (level + mythology
 * synergy — see loader.ts's buildCombatant). DEF/INI/ESQ/ICE are build
 * choices, not investable stats: every character starts at 0 for all four
 * and they only ever move when a specific ability or rune grants them —
 * docs/combate.md already establishes this for DEF ("é um investimento
 * ativo, não um stat passivo de todo personagem"); the same rule now
 * applies to INI/ESQ/ICE too.
 */
export interface BaseStats {
  hp: number;
  atk: number;
  /** Fraction of physical damage mitigated, e.g. 0.15 = ignores 15%. Ability/rune-granted only. */
  def: number;
  /** Turn-order priority, normally 0-1. Ability-granted only; ties keep team-list order (stable sort). */
  ini: number;
  /** Chance to fully dodge an attack, e.g. 0.10 = 10%. Ability/rune-granted only. */
  esq: number;
  /** ICE ("Intrusion Countermeasure Electronics") — fraction of physical damage received that reflects back onto the attacker. Ability/rune-granted only. */
  ice: number;
}

/** How an effect's numeric strength is computed. */
export type Magnitude =
  | { kind: 'flat'; value: number }
  | { kind: 'percent'; value: number }
  | { kind: 'percentOfMaxHp'; percent: number }
  | { kind: 'percentOfBaseAtk'; basePercent: number; perStarBonus?: number }
  /** Reuses the damage value of the attack that caused this trigger (the general Vírus rule). */
  | { kind: 'triggeringDamage' };

/**
 * The 8 target options from docs/combate.md section 6, plus `attacker`/
 * `defender` — context-bound single targets (whoever is involved in the
 * attack that caused the current trigger), an engine primitive the doc
 * doesn't name explicitly but that's needed for e.g. "quando aliado ataca"
 * abilities that want to buff/reference whoever just attacked.
 */
export type TargetSelector =
  | 'self'
  | 'attacker'
  | 'defender'
  | 'allEnemies'
  | 'allAllies'
  | 'lowestHpAlly'
  | 'highestAtkAlly'
  | 'randomAlly'
  | 'lowestEsqEnemy'
  | 'highestIniEnemy'
  | 'randomEnemy';

/**
 * The 9 triggers from docs/combate.md section 6 (battleStart=Início de
 * batalha, onDeath=ao morrer, onHalfHp=ao perder 50% da vida,
 * onShieldReceived=ao receber escudo, onAttack=ao atacar,
 * onAllyAttack=quando aliado ataca, onShieldBreak=quando escudo quebra,
 * onAllyShieldReceived=quando aliado recebe escudo, onHealReceived=quando
 * recebe cura), plus two engine-level additions the doc doesn't name but
 * real kits already use: onDamaged (fires on the unit that got hit,
 * regardless of whether its shield/HP changed) and onCriticalHit (fires
 * only when the attacking unit's own hit crits).
 */
export type AbilityTrigger =
  | 'battleStart'
  | 'onAttack'
  | 'onDamaged'
  | 'onCriticalHit'
  | 'onDeath'
  | 'onHalfHp'
  | 'onShieldReceived'
  | 'onAllyAttack'
  | 'onShieldBreak'
  | 'onAllyShieldReceived'
  | 'onHealReceived';

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

/** "Dano direto" (docs/combate.md section 6) — damage independent of the acting unit's basic attack. Always hits (no dodge roll) since it's an ability effect, not a physical attack. */
export interface DirectDamageEffect {
  type: 'directDamage';
  target: TargetSelector;
  magnitude: Magnitude;
  ignoresDef?: boolean;
  /** Backdoor-style: skip shield entirely and hit HP directly. */
  ignoresShield?: boolean;
}

export type BuffableAttribute = 'atk' | 'def' | 'ini' | 'esq';

/** "Buff de atributo (ATK/DEF/INI/ESQ)" (docs/combate.md section 6) — magnitude is a percent bonus, e.g. 0.3 = +30%. */
export interface BuffAttributeEffect {
  type: 'buffAttribute';
  target: TargetSelector;
  attribute: BuffableAttribute;
  /** Round count, "default" for the standard duration, or "permanent" for the rest of the battle. */
  duration: number | 'default' | 'permanent';
  magnitude: Magnitude;
}

export type AbilityEffect = ApplyStatusEffect | HealEffect | GrantShieldEffect | DirectDamageEffect | BuffAttributeEffect;

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
  buffAtk: number;
  buffDef: number;
  buffIni: number;
  buffEsq: number;
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
