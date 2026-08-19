// AUTO-GENERATED from src/engine — DO NOT EDIT BY HAND.
// Run `npm run sync:pvp-engine` after changing the engine.
// See scripts/sync-pvp-engine.mjs for why this copy exists.
import type { RngLike } from './rng.ts';
import type { AttackResult, Combatant } from './types.ts';
import { absorbIntoShield, consumeMark, effectiveAtk, effectiveDef, effectiveEsq, isMarked } from './statusEffects.ts';
import { CONSTANTS } from './loader.ts';

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

  // 3b. Execute — an equipped module can pay out extra against a target already on its last legs
  // (see core/modules.ts). Applied after mitigation so it scales what actually lands.
  const execute = attacker.modules.executeDamagePercent;
  if (execute > 0 && defender.maxHp > 0 && defender.hp / defender.maxHp < attacker.modules.executeThresholdPercent) {
    damage *= 1 + execute;
  }

  // 4. Crítico (Target guarantees it, and is consumed by the hit that uses it)
  let crit = isMarked(defender);
  if (crit) {
    consumeMark(defender);
  } else {
    crit = rng.chance(CONSTANTS.critChanceBase + attacker.modules.critChance);
  }
  if (crit) damage *= CONSTANTS.critMultiplier + attacker.modules.critDamage;

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
