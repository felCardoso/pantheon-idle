import type { RngLike } from './rng';
import type { AttackResult, Combatant } from './types';
import { consumeMark, effectiveAtk, effectiveDef, effectiveEsq, isMarked } from './statusEffects';
import { CONSTANTS } from './loader';

export interface ResolveAttackOptions {
  /** ATK multiplier for the attack's raw damage step; basic attacks are 100% ATK. */
  multiplier?: number;
  /** Backdoor-style effect: skip shield entirely and hit HP directly. Unused by the MVP roster. */
  ignoresShield?: boolean;
}

/**
 * Resolves a single attack following the exact order from docs/mvp.md section 2:
 * esquiva -> dano bruto -> mitigação por DEF -> crítico -> vantagem elemental -> escudo/HP.
 */
export function resolveAttack(
  attacker: Combatant,
  defender: Combatant,
  rng: RngLike,
  options: ResolveAttackOptions = {},
): AttackResult {
  const multiplier = options.multiplier ?? 1;

  // 1. Esquiva
  const dodged = rng.chance(effectiveEsq(defender));
  if (dodged) {
    return {
      attacker,
      defender,
      dodged: true,
      crit: false,
      elementalAdvantage: false,
      rawDamage: 0,
      finalDamage: 0,
      shieldAbsorbed: 0,
      hpDamage: 0,
      defenderDied: false,
    };
  }

  // 2. Dano bruto
  const rawDamage = effectiveAtk(attacker) * multiplier;

  // 3. Mitigação por DEF
  let damage = rawDamage * (100 / (100 + effectiveDef(defender)));

  // 4. Crítico (Marcado guarantees it, and is consumed by the hit that uses it)
  let crit = isMarked(defender);
  if (crit) {
    consumeMark(defender);
  } else {
    crit = rng.chance(CONSTANTS.critChanceBase);
  }
  if (crit) damage *= CONSTANTS.critMultiplier;

  // 5. Vantagem elemental
  const counters = attacker.element ? CONSTANTS.elementalCounters[attacker.element] : undefined;
  const elementalAdvantage = Boolean(defender.element && counters?.includes(defender.element));
  if (elementalAdvantage) damage *= CONSTANTS.elementalAdvantageMultiplier;

  const finalDamage = damage;

  // 6. Destino do dano: escudo primeiro (salvo Backdoor), excedente pro HP
  let shieldAbsorbed = 0;
  let hpDamage = finalDamage;
  if (!options.ignoresShield && defender.shield > 0) {
    shieldAbsorbed = Math.min(defender.shield, finalDamage);
    defender.shield -= shieldAbsorbed;
    hpDamage = finalDamage - shieldAbsorbed;
  }
  defender.hp = Math.max(0, defender.hp - hpDamage);

  return {
    attacker,
    defender,
    dodged: false,
    crit,
    elementalAdvantage,
    rawDamage,
    finalDamage,
    shieldAbsorbed,
    hpDamage,
    defenderDied: defender.hp <= 0,
  };
}
