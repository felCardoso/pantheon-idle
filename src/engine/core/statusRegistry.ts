import type { BuffableAttribute, StatusType } from '../schema';

/**
 * Single source of truth for how every status behaves.
 *
 * Before this table the same knowledge was spread across four separate
 * constants (DAMAGE_OVER_TIME / DEBUFF_STATUSES / BUFF_STATUSES /
 * defaultIgnoresShield) plus five near-identical `effectiveX` helpers, so
 * adding one status meant remembering to touch all of them. Now a status is
 * defined in exactly one place: add an entry here and every consumer —
 * ticking, dispel bucketing, stat math, shield rules — picks it up.
 *
 * See docs/combate.md v3.1 §4 for the design-side description of each.
 */

/** What a status does on each whole-second tick. */
export type StatusTickKind =
  /** Deals `value` damage per second. */
  | 'damage'
  /** Heals `value` per second. */
  | 'heal'
  /** No periodic effect — the status only matters while present. */
  | 'none';

/**
 * How a status modifies a base stat. `multiplier` values are summed across
 * instances and applied as `base * (1 + sum)`; `reduction` as `base * (1 - sum)`.
 */
export interface StatusStatModifier {
  attribute: BuffableAttribute;
  mode: 'multiplier' | 'reduction';
}

export interface StatusDescriptor {
  /** Player-facing bucket. Debuffs and buffs are dispelled independently. */
  kind: 'debuff' | 'buff';
  tick: StatusTickKind;
  /** True if its damage bypasses Shield entirely (Trojan). */
  ignoresShield?: boolean;
  /** Set when the status changes a stat — drives statusEffects' effective* math. */
  modifies?: StatusStatModifier;
  /** Multiple applications coexist instead of replacing each other (Leak). */
  stacksByDefault?: boolean;
}

export const STATUS_REGISTRY: Record<StatusType, StatusDescriptor> = {
  // --- Malwares (docs/combate.md v3.1 §4) ---
  /** "Dano fixo por segundo, ignora Firewall (DEF) e pode empilhar." DEF is
   * bypassed at application time (the effect sets ignoresDef), not here. */
  leak: { kind: 'debuff', tick: 'damage', stacksByDefault: true },
  /** "Dano por segundo que ignora completamente qualquer Escudo ativo." */
  trojan: { kind: 'debuff', tick: 'damage', ignoresShield: true },
  /** Stun — suppresses the Vanguard's basic attack while present. */
  crash: { kind: 'debuff', tick: 'none' },
  /** Inflates how much shield each point of damage costs to absorb. */
  fragmentation: { kind: 'debuff', tick: 'none' },
  /** "Reduz o Processamento (ATK) em X%." */
  throttling: { kind: 'debuff', tick: 'none', modifies: { attribute: 'atk', mode: 'reduction' } },
  /** "Reduz o Ping (VEL)" — slows the attack cadence. */
  lag: { kind: 'debuff', tick: 'none', modifies: { attribute: 'vel', mode: 'reduction' } },

  // --- Protocolos ---
  /** "Aplica cura/reparo contínuo por segundo." */
  nanites: { kind: 'buff', tick: 'heal' },
  /** Consumed by the next incoming hit, which is guaranteed to crit. */
  target: { kind: 'buff', tick: 'none' },

  // --- Generic attribute buffs -------------------------------------------
  // A negative magnitude on any of these is how attribute *debuffs* without a
  // dedicated named status are expressed — e.g. "Corrosão" (§7) is a negative
  // buffDef. The bucket stays 'buff' for dispel-targeting purposes.
  buffAtk: { kind: 'buff', tick: 'none', modifies: { attribute: 'atk', mode: 'multiplier' } },
  buffDef: { kind: 'buff', tick: 'none', modifies: { attribute: 'def', mode: 'multiplier' } },
  buffVel: { kind: 'buff', tick: 'none', modifies: { attribute: 'vel', mode: 'multiplier' } },
  buffEsq: { kind: 'buff', tick: 'none', modifies: { attribute: 'esq', mode: 'multiplier' } },
  buffIce: { kind: 'buff', tick: 'none', modifies: { attribute: 'ice', mode: 'multiplier' } },
};

const ALL_STATUSES = Object.keys(STATUS_REGISTRY) as StatusType[];

/** Statuses in the given dispel bucket — replaces the old hand-kept Sets. */
export function statusesOfKind(kind: 'debuff' | 'buff'): StatusType[] {
  return ALL_STATUSES.filter((s) => STATUS_REGISTRY[s].kind === kind);
}

/** Every status that modifies `attribute`, split by how it applies. */
export function modifiersFor(attribute: BuffableAttribute): { multipliers: StatusType[]; reductions: StatusType[] } {
  const multipliers: StatusType[] = [];
  const reductions: StatusType[] = [];
  for (const s of ALL_STATUSES) {
    const mod = STATUS_REGISTRY[s].modifies;
    if (!mod || mod.attribute !== attribute) continue;
    (mod.mode === 'multiplier' ? multipliers : reductions).push(s);
  }
  return { multipliers, reductions };
}

export function statusIgnoresShield(status: StatusType): boolean {
  return STATUS_REGISTRY[status].ignoresShield ?? false;
}

export function statusStacksByDefault(status: StatusType): boolean {
  return STATUS_REGISTRY[status].stacksByDefault ?? false;
}
