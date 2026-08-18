// Data-driven combat schema: characters, enemies and abilities are plain JSON
// (see src/engine/data/**) interpreted at runtime by the ability engine. Adding
// a new world/character/enemy means adding data, not code — see docs/combate.md
// (v3.1) for the Relay & Bench design this mirrors. There is no elemental-
// affinity system ("Não há elementos com pedra-papel-tesoura") — tactical
// variety comes entirely from status effects and loadout choices.
//
// v3.1 is real-time continuous: there are no turns, rounds or initiative order.
// Everything that used to be measured in rounds is now measured in SECONDS, and
// only the Vanguard (index 0 of each side's queue) attacks or takes damage.

export type Faction = 'Firewall' | 'Malware' | 'Crypto-Miner' | 'Exploit';

export type Rarity = 'Alpha' | 'Beta' | 'Stable' | 'LTS' | 'Zero-Day';

/** Ascending rank — higher number is rarer. Lives here (not src/data/roster.ts) so loader.ts's ability-selection resolution doesn't have to reach outside the engine layer; re-exported from roster.ts for existing UI call sites. */
export const RARITY_RANK: Record<Rarity, number> = { Alpha: 0, Beta: 1, Stable: 2, LTS: 3, 'Zero-Day': 4 };

/**
 * Lowest owned rarity that unlocks a character's passive ability —
 * docs/combate.md v3.1 §3: "Desbloqueada automaticamente apenas para
 * personagens Zero-Day".
 *
 * Raised from LTS with no data migration needed: passive level 1 was always
 * free and PASSIVE_MAX_LEVEL_BY_RARITY capped LTS at exactly 1, so the paid
 * tier (level 2, 50k créditos) was never reachable below Zero-Day — nobody
 * can have bought something this takes away. Stale `passive_level` rows on
 * non-Zero-Day characters are simply ignored: the passive is re-gated by
 * rarity at load time (see resolveCombatantAbilities in loader.ts), so the
 * value lies dormant and becomes valid again if that character ever reaches
 * Zero-Day.
 *
 * Not implemented: §3's second unlock path ("através das melhorias de
 * personagem, quando ele sobe para a v2.0") — no character-versioning system
 * exists yet.
 */
export const PASSIVE_UNLOCK_RARITY: Rarity = 'Zero-Day';

/**
 * The 8 named statuses from docs/combate.md v3.1 §4, plus the 5 generic
 * buff/debuff-attribute statuses (buffX with a negative magnitude is how
 * Firewall/Ping/Evasion/ESP debuffs are expressed — there's no dedicated
 * named status for those, unlike Throttling/Lag which do have one).
 *
 * "Corrosão" (Set.exe / Corrupted Daemon, §7) is not a distinct status: it is
 * a Firewall reduction, i.e. a negative-magnitude `buffDef`.
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
  | 'buffVel'
  | 'buffEsq'
  | 'buffIce';

/**
 * HP/ATK are the only stats that grow generically (level + mythology
 * synergy — see loader.ts's buildCombatant). DEF/VEL/ESQ/ICE are build
 * choices, not investable stats: every playable character starts at 0 for
 * all four and they only ever move when a specific ability, Bench ability or
 * Módulo grants them (docs/combate.md v3.1 §2: "Iniciam em 0 e só são
 * alterados por Habilidades, Banco ou Módulos"). Enemies are the deliberate
 * exception (world/estágio difficulty balancing, not a player build system).
 */
export interface BaseStats {
  hp: number;
  atk: number;
  /** Firewall — fraction of physical damage mitigated, e.g. 0.15 = ignores 15%. Ability/rune-granted only. */
  def: number;
  /** Ping — attack SPEED. Drives how often the Vanguard attacks; see attackIntervalFor() below. Ability/rune-granted only. */
  vel: number;
  /** Evasion — chance to fully dodge an attack, e.g. 0.10 = 10%. Ability/rune-granted only. */
  esq: number;
  /** ESP ("ICE" internally) — thorns. Reflects this fraction of the incoming attack's damage back onto the attacker. Ability/rune-granted only. */
  ice: number;
}

/**
 * VEL -> seconds between basic attacks. docs/combate.md v3.1 §2 defines VEL as
 * "a frequência (Cooldown/Tick) com que o processo executa seus ataques
 * básicos" but gives no formula, and every playable character starts at VEL 0,
 * so a base interval is required for the stat to mean anything.
 *
 * Diminishing-returns shape (interval = base / (1 + vel)) rather than linear
 * subtraction: it can never reach zero, so no stacked Ping buff can produce an
 * infinite-attacks-per-tick loop. The floor is a second, independent guard.
 */
export const BASE_ATTACK_INTERVAL_SECONDS = 2.0;
export const MIN_ATTACK_INTERVAL_SECONDS = 0.25;

export function attackIntervalFor(vel: number): number {
  return Math.max(MIN_ATTACK_INTERVAL_SECONDS, BASE_ATTACK_INTERVAL_SECONDS / (1 + Math.max(0, vel)));
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
 * Targeting. In Relay & Bench only the Vanguard of each side is on the field,
 * so "1 inimigo" and "todos os inimigos" collapse to the enemy Vanguard for
 * damage purposes — the multi-enemy selectors are kept because bench-wide
 * buffs and boss kits that hit "toda a linha inimiga" (Fenrir, §7B) still need
 * to address whole queues.
 */
export type TargetSelector =
  | 'self'
  | 'attacker'
  | 'defender'
  /** The acting unit's own side's current Vanguard (index 0) — the only ally that can be damaged/healed in combat. */
  | 'ownVanguard'
  /** The opposing side's current Vanguard. */
  | 'enemyVanguard'
  | 'allEnemies'
  | 'allAllies'
  /** Benched allies only (excludes the Vanguard) — for kits that buff the reserve. */
  | 'benchAllies'
  | 'lowestHpAlly'
  | 'highestAtkAlly'
  | 'randomAlly'
  | 'lowestEsqEnemy'
  | 'highestAtkEnemy'
  | 'lowestHpEnemy'
  | 'randomEnemy';

/**
 * Trigger vocabulary for the real-time engine.
 *
 * Removed from v2, with no data migration needed (a survey of
 * src/engine/data/abilities.json shows the authored kits only use battleStart,
 * onAttack, onCounter and onCriticalHit):
 * - `roundStart` / `roundEnd` ("Loop Start/End") — there are no rounds.
 * - `onPingAdvantage` — Ping is no longer an initiative comparison.
 * - `onFrontAllyWounded` — the Vanguard IS the only ally that can be wounded,
 *   so this collapsed into `onAllyWounded`.
 *
 * Added for Relay & Bench:
 * - `onVanguardEnter` / `onVanguardExit` — a unit rotating into/out of the
 *   front. Bench abilities hook these to attach/detach their buffs.
 */
export type AbilityTrigger =
  | 'battleStart' // Boot Sequence
  | 'constant' // Background Service — always-on; for bench abilities this is the normal choice
  | 'preAttack' // Pre-Execution
  | 'onAttack' // Execution
  | 'postAttack' // Post-Execution
  | 'onCounter' // Counter (Riposte)
  | 'onWounded' // Data Loss
  | 'onHalfHp' // Critical Sector (Yamata-no-Orochi's 50% threshold, §7B)
  | 'onDeath' // System Failure
  | 'onKill' // Process Terminated
  | 'onShieldReceived' // Firewall Active
  | 'onShieldBreak' // Firewall Breach
  | 'onHealReceived' // Nanites Received
  | 'onAllyAttack' // Co-op Processing — fires on benched allies when the Vanguard attacks
  | 'onAllyWounded' // Network Breach
  | 'onAllyDeath' // Node Offline (Set.exe's passive, §7B)
  | 'onAllyShieldReceived' // Network Firewall
  | 'onAllyShieldBreak' // Network Breach (Ally Shield Broken)
  | 'onAllyAppliedTrojan' // Trojan Echo
  | 'onAllyAppliedLeak' // Leak Echo
  | 'onAllyAppliedCrash' // Crash Echo
  | 'onDodge' // Ghosting
  | 'onVanguardEnter' // rotated into the front
  | 'onVanguardExit' // rotated out of the front (ejected)
  | 'onCriticalHit'; // engine-only, no doc equivalent

/**
 * Where an ability may run (docs/combate.md v3.1 §3).
 * - `active`: only while its owner is the Vanguard. Player picks 1 of 2.
 * - `bench`: only while its owner is benched; buffs the allied Vanguard. Player picks 1 of 2.
 * - `passive`: always on, tier-gated, no player choice.
 */
export type AbilityScope = 'active' | 'bench' | 'passive';

export interface ApplyStatusEffect {
  type: 'applyStatus';
  target: TargetSelector;
  status: StatusType;
  /** Seconds, or "default" to use the standard duration table (constants.json). */
  durationSeconds: number | 'default';
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
  /** Ogum.exe (§7B): "quebra Escudos imediatamente" — zeroes the target's shield before applying damage. */
  breaksShield?: boolean;
  /** Yamata-no-Orochi (§7B): "múltiplos hits sequenciais instantâneos com dano reduzido". Defaults to 1. */
  hits?: number;
}

export type BuffableAttribute = 'atk' | 'def' | 'vel' | 'esq' | 'ice';

/** "Buff de atributo (Processamento/Firewall/Ping/Evasion/ESP)" — magnitude is a percent bonus, e.g. 0.3 = +30%. A negative magnitude is how attribute debuffs beyond Throttling/Lag (which have their own dedicated statuses) are expressed — e.g. Corrosão (a Firewall reduction) is just this with a negative value on `def`. */
export interface BuffAttributeEffect {
  type: 'buffAttribute';
  target: TargetSelector;
  attribute: BuffableAttribute;
  /** Seconds, "default" for the standard duration, or "permanent" for the rest of the battle. */
  durationSeconds: number | 'default' | 'permanent';
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
  /** Which slot this ability occupies — gates when the engine will even consider firing it. */
  scope: AbilityScope;
  trigger: AbilityTrigger;
  /**
   * Seconds between repeat firings. Only meaningful for `constant`-triggered
   * abilities, which is how the doc's cooldown bosses are expressed — Fenrir
   * "a cada 4 segundos", Ogum "a cada 3 segundos" (§7B). Omit for
   * event-triggered abilities, which fire whenever their event fires.
   */
  cooldownSeconds?: number;
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
   * Candidate active-ability ids (docs/combate.md v3.1 §3: "2 opções de
   * habilidades ativas, o jogador escolhe 1"). Not a fixed-length tuple —
   * enemies carry exactly 1 fixed ability (§7A) and not-yet-rebalanced
   * characters may still carry 3 from v2. The engine always resolves exactly
   * one at load time (the player's selection, or activeOptions[0] by default).
   */
  activeOptions: string[];
  /**
   * Candidate bench-ability ids (§3: "2 opções de habilidades de banco, o
   * jogador escolhe 1"). Empty for enemies — §7A: "sem Habilidade de Banco".
   */
  benchOptions?: string[];
  /** Tier-gated; single fixed passive, always active once unlocked. Undefined = not authored yet. */
  passiveAbilityId?: string;
  /** Jurupari.exe's passive: +N seconds to any status this unit applies. */
  statusDurationBonus?: number;
}

/** Default status durations, in SECONDS. */
export interface StatusDurationTable {
  leak: number;
  trojan: number;
  crash: number;
  fragmentation: number;
  nanites: number;
  throttling: number;
  lag: number;
  /** "Até o próximo ataque recebido" — not time-based, null marks that. */
  target: null;
  buffAtk: number;
  buffDef: number;
  buffVel: number;
  buffEsq: number;
  buffIce: number;
}

export interface CombatConstants {
  critChanceBase: number;
  critMultiplier: number;
  /** Simulation granularity. Every cooldown/duration is resolved in whole ticks. */
  tickSeconds: number;
  statusDefaultDurations: StatusDurationTable;
  synergyByCount: Record<string, number>;
  /** docs/combate.md v3.1 §6 — all thresholds in seconds. */
  antiInfinite: {
    /** Hard stop; battle is aborted as a draw. */
    timeLimitSeconds: number;
    /** When System Overload starts ticking. */
    overloadStartSeconds: number;
    /** How often overload damage lands once started ("a cada 5 segundos"). */
    overloadIntervalSeconds: number;
    /** Absolute damage as a fraction of max HP, added per overload tick ("5% aos 31s, 10% aos 36s"). */
    overloadStepPercent: number;
  };
}
