/**
 * Equipment bonuses, as a flat bag of numbers.
 *
 * The engine deliberately knows nothing about "runes", rarities, slots or card art — that is all
 * src/data/modules.ts's business. What crosses the boundary is this: already-resolved totals the
 * simulation can apply without interpreting anything. Keeping it shaped this way means rebalancing
 * a rune, adding a grade, or changing how many bonuses a grade grants never touches the engine.
 *
 * Percent-shaped fields are fractions (0.025 = +2.5%). Every field is additive across the four
 * equipped slots, so two runes granting crit chance stack.
 */
export interface ModuleBonuses {
  /** Added to CONSTANTS.critChanceBase. */
  critChance: number;
  /** Added to CONSTANTS.critMultiplier, so +0.2 turns a 1.5x crit into 1.7x. */
  critDamage: number;
  attackPercent: number;
  maxHpPercent: number;
  /** Added to the DEF fraction. */
  defense: number;
  /** Added to ICE — the fraction of incoming damage reflected. */
  thorns: number;
  /** Shield granted at battle start, as a fraction of max HP. */
  initialShieldPercent: number;
  dodge: number;
  /** Scales damage dealt by damage-over-time statuses this unit applied. */
  statusDamagePercent: number;
  /** Scales healing this unit receives. */
  healEfficiencyPercent: number;
  /** Revives once at this fraction of max HP the first time the unit would die. 0 = no revive. */
  reviveOncePercent: number;
  /** Clears this unit's debuffs this often while it is the Vanguard. null = never. */
  cleanseIntervalSeconds: number | null;
  /** Extra damage dealt to targets below executeThresholdPercent of their max HP. */
  executeDamagePercent: number;
  executeThresholdPercent: number;
}

export const NO_MODULE_BONUSES: ModuleBonuses = {
  critChance: 0,
  critDamage: 0,
  attackPercent: 0,
  maxHpPercent: 0,
  defense: 0,
  thorns: 0,
  initialShieldPercent: 0,
  dodge: 0,
  statusDamagePercent: 0,
  healEfficiencyPercent: 0,
  reviveOncePercent: 0,
  cleanseIntervalSeconds: null,
  executeDamagePercent: 0,
  executeThresholdPercent: 0,
};

/** Sums several loadouts into one. The shortest cleanse interval wins — they don't stack. */
export function mergeModuleBonuses(bonuses: Partial<ModuleBonuses>[]): ModuleBonuses {
  const total = { ...NO_MODULE_BONUSES };
  for (const b of bonuses) {
    total.critChance += b.critChance ?? 0;
    total.critDamage += b.critDamage ?? 0;
    total.attackPercent += b.attackPercent ?? 0;
    total.maxHpPercent += b.maxHpPercent ?? 0;
    total.defense += b.defense ?? 0;
    total.thorns += b.thorns ?? 0;
    total.initialShieldPercent += b.initialShieldPercent ?? 0;
    total.dodge += b.dodge ?? 0;
    total.statusDamagePercent += b.statusDamagePercent ?? 0;
    total.healEfficiencyPercent += b.healEfficiencyPercent ?? 0;
    total.reviveOncePercent = Math.max(total.reviveOncePercent, b.reviveOncePercent ?? 0);
    if (b.cleanseIntervalSeconds != null) {
      total.cleanseIntervalSeconds =
        total.cleanseIntervalSeconds == null ? b.cleanseIntervalSeconds : Math.min(total.cleanseIntervalSeconds, b.cleanseIntervalSeconds);
    }
    // The strongest execute wins outright rather than summing — two execute runes shouldn't
    // multiply into a finisher that deletes anything below the threshold.
    if ((b.executeDamagePercent ?? 0) > total.executeDamagePercent) {
      total.executeDamagePercent = b.executeDamagePercent ?? 0;
      total.executeThresholdPercent = b.executeThresholdPercent ?? 0;
    }
  }
  return total;
}
