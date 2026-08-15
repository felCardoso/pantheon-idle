// Data-driven combat schema: characters, enemies and abilities are plain JSON
// (see src/engine/data/**) interpreted at runtime by the ability engine. Adding
// a new world/character/enemy means adding data, not code — see docs/combate.md
// (v2) for the Gatilho x Efeito x Alvo design this mirrors. There is no
// elemental-affinity system in v2 ("Não existe um sistema de elementos") —
// tactical variety comes entirely from status effects and positioning.

export type Faction = 'Firewall' | 'Malware' | 'Crypto-Miner' | 'Exploit';

export type Rarity = 'Alpha' | 'Beta' | 'Stable' | 'LTS' | 'Zero-Day';

/**
 * The 8 named statuses from docs/combate.md section 3, plus the 5 generic
 * buff/debuff-attribute statuses (buffX with a negative magnitude is how
 * Firewall/Ping/Evasion/ESP debuffs are expressed — there's no dedicated
 * named status for those, unlike Throttling/Lag which do have one).
 */
export type StatusType =
  | 'leak'
  | 'trojan'
  | 'crash'
  | 'fragmentation'
  | 'nanites'
  | 'throttling'
  | 'lag'
  | 'target'
  | 'buffAtk'
  | 'buffDef'
  | 'buffIni'
  | 'buffEsq'
  | 'buffIce';

/**
 * HP/ATK are the only stats that grow generically (level + mythology
 * synergy — see loader.ts's buildCombatant). DEF/INI/ESQ/ICE are build
 * choices, not investable stats: every playable character starts at 0 for
 * all four and they only ever move when a specific ability or Módulo grants
 * them. Enemies are the deliberate exception (world/estágio difficulty
 * balancing, not a player build system).
 */
export interface BaseStats {
  hp: number;
  atk: number;
  /** Firewall — fraction of physical damage mitigated, e.g. 0.15 = ignores 15%. Ability/rune-granted only. */
  def: number;
  /** Ping — turn priority within a line-up clash, normally 0-1. Ability-granted only. */
  ini: number;
  /** Evasion — chance to fully dodge an attack, e.g. 0.10 = 10%. Ability/rune-granted only. */
  esq: number;
  /** ESP ("ICE" internally) — fraction of physical damage received that reflects back onto the attacker. Ability/rune-granted only. */
  ice: number;
}

/** How an effect's numeric strength is computed. */
export type Magnitude =
  | { kind: 'flat'; value: number }
  | { kind: 'percent'; value: number }
  | { kind: 'percentOfMaxHp'; percent: number }
  | { kind: 'percentOfBaseAtk'; basePercent: number; perStarBonus?: number }
  /** Reuses the damage value of the attack that caused this trigger. */
  | { kind: 'triggeringDamage' };

/**
 * docs/combate.md section 6's target list — self, 1 aliado (menor HP / maior
 * ATK / aliado da frente / aleatório), todos os aliados, 1 inimigo (menor
 * Evasion / maior Ping / aleatório), todos os inimigos — plus `attacker`/
 * `defender`, two context-bound engine primitives the doc doesn't name
 * explicitly but that are needed for triggers like "ao ser atingido" (mira em
 * quem atacou) or "ao atacar" (mira em quem está sendo atacado).
 */
export type TargetSelector =
  | 'self'
  | 'attacker'
  | 'defender'
  | 'allEnemies'
  | 'allAllies'
  | 'lowestHpAlly'
  | 'highestAtkAlly'
  | 'frontAlly'
  | 'randomAlly'
  | 'lowestEsqEnemy'
  | 'highestIniEnemy'
  | 'randomEnemy';

/**
 * docs/combate.md section 6's ~26 named triggers, translated to camelCase
 * identifiers, plus `onCriticalHit` — one engine-only addition beyond the
 * doc's list (fires only when the acting unit's own hit crits; no named v2
 * trigger covers this, and 6 existing kits already depend on it). Two notes
 * on how the doc's prose maps to these identifiers:
 * - The doc names two different triggers "Network Breach" (ally wounded vs.
 *   ally shield broken) — disambiguated here as `onAllyWounded` /
 *   `onAllyShieldBreak`.
 * - `onAttack` keeps its pre-v2 semantics (fires after the unit's own basic
 *   attack resolves, doesn't replace it) rather than the doc's literal
 *   "Execution substitui o ataque básico" — no current kit needs an ability
 *   to replace the basic attack, so that mechanic isn't implemented yet.
 * - `constant` ("Background Service") isn't a real fireable event; abilities
 *   using it fire once at battleStart, same call site as `battleStart`
 *   itself — authoring one is equivalent to a battleStart-trigger ability
 *   with `duration: 'permanent'` effects.
 */
export type AbilityTrigger =
  | 'battleStart' // Boot Sequence
  | 'roundStart' // Loop Start
  | 'roundEnd' // Loop End
  | 'constant' // Background Service
  | 'preAttack' // Pre-Execution
  | 'onAttack' // Execution
  | 'postAttack' // Post-Execution
  | 'onCounter' // Counter (Riposte)
  | 'onWounded' // Data Loss
  | 'onHalfHp' // Critical Sector
  | 'onDeath' // System Failure
  | 'onKill' // Process Terminated
  | 'onShieldReceived' // Firewall Active
  | 'onShieldBreak' // Firewall Breach
  | 'onHealReceived' // Nanites Received
  | 'onAllyAttack' // Co-op Processing
  | 'onFrontAllyWounded' // Proxy Defense
  | 'onAllyWounded' // Network Breach (Ally Wounded)
  | 'onAllyDeath' // Node Offline
  | 'onAllyShieldReceived' // Network Firewall
  | 'onAllyShieldBreak' // Network Breach (Ally Shield Broken)
  | 'onAllySpawned' // Instance Spawned — inert until a summon mechanic exists
  | 'onAllyAppliedTrojan' // Trojan Echo
  | 'onAllyAppliedLeak' // Leak Echo
  | 'onAllyAppliedCrash' // Crash Echo
  | 'onDodge' // Ghosting
  | 'onPingAdvantage' // Ping Advantage
  | 'onCriticalHit'; // engine-only, no v2 equivalent

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

/** "Dano direto" — damage independent of the acting unit's basic attack. Always hits (no dodge roll) since it's an ability effect, not a physical attack. */
export interface DirectDamageEffect {
  type: 'directDamage';
  target: TargetSelector;
  magnitude: Magnitude;
  ignoresDef?: boolean;
  /** Backdoor-style: skip shield entirely and hit HP directly. */
  ignoresShield?: boolean;
}

export type BuffableAttribute = 'atk' | 'def' | 'ini' | 'esq' | 'ice';

/** "Buff de atributo (Processamento/Firewall/Ping/Evasion/ESP)" — magnitude is a percent bonus, e.g. 0.3 = +30%. A negative magnitude is how attribute debuffs beyond Throttling/Lag (which have their own dedicated statuses) are expressed — e.g. a Firewall-reduction effect is just this with a negative value on `def`. */
export interface BuffAttributeEffect {
  type: 'buffAttribute';
  target: TargetSelector;
  attribute: BuffableAttribute;
  /** Round count, "default" for the standard duration, or "permanent" for the rest of the battle. */
  duration: number | 'default' | 'permanent';
  magnitude: Magnitude;
}

/** "Quebra direta de status inimigo" — strips active statuses from the target instead of applying a new one. */
export interface DispelEffect {
  type: 'dispel';
  target: TargetSelector;
  /** Which statuses to strip. Omitted = strip whichever bucket (debuffs or buffs) the target currently has active — see DEBUFF_STATUSES/BUFF_STATUSES in statusEffects.ts. */
  statuses?: StatusType[];
}

export type AbilityEffect = ApplyStatusEffect | HealEffect | GrantShieldEffect | DirectDamageEffect | BuffAttributeEffect | DispelEffect;

export interface AbilityDefinition {
  id: string;
  name: string;
  /** Passive: LTS+ only, always active, no player choice. Active: one of a character's activeOptions, player-equipped. */
  kind: 'active' | 'passive';
  trigger: AbilityTrigger;
  /** Probability in [0, 1] that the ability fires when its trigger fires. Omit for guaranteed (1). */
  chance?: number;
  effects: AbilityEffect[];
}

export interface CombatantData {
  id: string;
  name: string;
  faction: Faction | null;
  rarity?: Rarity;
  mythology?: string;
  stars?: number;
  baseStats: BaseStats;
  /**
   * Candidate active-ability ids (docs/combate.md section 5: "todo
   * personagem possui 3 opções de habilidades ativas, o jogador equipa uma
   * por vez"). Not a fixed-length tuple — enemies and not-yet-rebalanced
   * characters may carry fewer or more than 3 until authored to the target
   * shape. The engine always resolves exactly one at load time (the
   * player's selection, or activeOptions[0] if none chosen yet).
   */
  activeOptions: string[];
  /** LTS+ only; single fixed passive, always active once unlocked. Undefined = not authored yet. */
  passiveAbilityId?: string;
  /** Jurupari.exe's passive: +N rounds to any status this unit applies. */
  statusDurationBonus?: number;
  /** Saci.exe's passive: this unit always wins Ping priority in its own line-up clash. */
  alwaysActsFirst?: boolean;
}

export interface StatusDurationTable {
  leak: number;
  trojan: number;
  crash: number;
  fragmentation: number;
  nanites: number;
  throttling: number;
  lag: number;
  /** "Até o próximo ataque recebido" — not round-based, null marks that. */
  target: null;
  buffAtk: number;
  buffDef: number;
  buffIni: number;
  buffEsq: number;
  buffIce: number;
}

export interface CombatConstants {
  critChanceBase: number;
  critMultiplier: number;
  statusDefaultDurations: StatusDurationTable;
  synergyByCount: Record<string, number>;
  antiInfiniteRound: {
    roundLimit: number;
    enrageStartRound: number;
    enrageBasePercent: number;
  };
}
