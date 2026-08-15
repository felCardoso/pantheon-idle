import type { RngLike } from './rng';
import type { AttackResult, Combatant } from './types';
import { absorbIntoShield, consumeMark, effectiveAtk, effectiveDef, effectiveEsq, isMarked } from './statusEffects';
import { CONSTANTS } from './loader';

export interface ResolveAttackOptions {
  /** ATK multiplier for the attack's raw damage step; basic attacks are 100% ATK. */
  multiplier?: number;
  /** Backdoor-style effect: skip shield entirely and hit HP directly. Unused by the MVP roster. */
  ignoresShield?: boolean;
}

/**
 * Resolves a single attack: esquiva -> dano bruto -> mitigação por Firewall
 * -> crítico -> escudo/HP. There's no elemental-advantage step — v2 has no
 * elemental-affinity system.
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
      rawDamage: 0,
      finalDamage: 0,
      shieldAbsorbed: 0,
      hpDamage: 0,
      defenderDied: false,
    };
  }

  // 2. Dano bruto
  const rawDamage = effectiveAtk(attacker) * multiplier;

  // 3. Mitigação por Firewall (fração direta do dano físico ignorada, ex.: 0.15 = ignora 15%)
  let damage = rawDamage * (1 - effectiveDef(defender));

  // 4. Crítico (Target guarantees it, and is consumed by the hit that uses it)
  let crit = isMarked(defender);
  if (crit) {
    consumeMark(defender);
  } else {
    crit = rng.chance(CONSTANTS.critChanceBase);
  }
  if (crit) damage *= CONSTANTS.critMultiplier;

  const finalDamage = damage;

  // 5. Destino do dano: escudo primeiro (salvo Backdoor ou Fragmentação-inflacionado), excedente pro HP
  const { shieldAbsorbed, hpDamage } = absorbIntoShield(defender, finalDamage, options.ignoresShield);
  defender.hp = Math.max(0, defender.hp - hpDamage);

  return {
    attacker,
    defender,
    dodged: false,
    crit,
    rawDamage,
    finalDamage,
    shieldAbsorbed,
    hpDamage,
    defenderDied: defender.hp <= 0,
  };
}
