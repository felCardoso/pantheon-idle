import type { AbilityDefinition, AbilityEffect, BuffableAttribute, Magnitude, StatusType, TargetSelector } from '../engine';

/**
 * Turns an ability's first effect into a short Portuguese clause for the battle log —
 * e.g. "5% de dano nos inimigos que estão no banco" — so every 'abilityUsed' entry can
 * read as "<Nome> usou <Habilidade> - <descrição>" (see docs request: the log must always
 * name what an ability actually did, not just that it fired).
 */

const TARGET_LABEL: Record<TargetSelector, string> = {
  self: 'em si mesmo',
  attacker: 'no atacante',
  defender: 'no defensor',
  ownVanguard: 'no Vanguard aliado',
  enemyVanguard: 'no Vanguard inimigo',
  allEnemies: 'em todos os inimigos',
  allAllies: 'em todos os aliados',
  benchAllies: 'nos aliados que estão no banco',
  lowestHpAlly: 'no aliado com menos vida',
  highestAtkAlly: 'no aliado com mais ataque',
  randomAlly: 'em um aliado aleatório',
  lowestEsqEnemy: 'no inimigo com menor evasão',
  highestAtkEnemy: 'no inimigo com mais ataque',
  lowestHpEnemy: 'no inimigo com menos vida',
  randomEnemy: 'em um inimigo aleatório',
};

const STATUS_LABEL: Record<StatusType, string> = {
  leak: 'Leak',
  trojan: 'Trojan',
  crash: 'Crash',
  fragmentation: 'Fragmentação',
  nanites: 'Nanites',
  throttling: 'Throttling',
  lag: 'Lag',
  target: 'Target',
  buffAtk: 'Processamento',
  buffDef: 'Firewall',
  buffVel: 'Ping',
  buffEsq: 'Evasion',
  buffIce: 'ESP',
};

const ATTRIBUTE_LABEL: Record<BuffableAttribute, string> = {
  atk: 'Processamento',
  def: 'Firewall',
  vel: 'Ping',
  esq: 'Evasion',
  ice: 'ESP',
};

function magnitudeText(magnitude: Magnitude): string {
  switch (magnitude.kind) {
    case 'flat':
      return `${magnitude.value}`;
    case 'percent':
      return `${Math.round(Math.abs(magnitude.value) * 100)}%`;
    case 'percentOfMaxHp':
      return `${Math.round(Math.abs(magnitude.percent) * 100)}% da vida máxima`;
    case 'percentOfBaseAtk':
      return `${Math.round(Math.abs(magnitude.basePercent) * 100)}% do ataque`;
    case 'triggeringDamage':
      return 'o dano do golpe';
  }
}

/** For attribute/percent magnitudes, whether this reads as a buff (+) or a debuff (-). */
function isNegative(magnitude: Magnitude): boolean {
  return (magnitude.kind === 'flat' || magnitude.kind === 'percent') && magnitude.value < 0;
}

function describeEffect(effect: AbilityEffect): string {
  const target = TARGET_LABEL[effect.target];
  switch (effect.type) {
    case 'applyStatus':
      return `aplica ${STATUS_LABEL[effect.status]} ${target}`;
    case 'heal':
      return `cura ${magnitudeText(effect.magnitude)} ${target}`;
    case 'grantShield':
      return `concede escudo de ${magnitudeText(effect.magnitude)} ${target}`;
    case 'directDamage':
      return `${magnitudeText(effect.magnitude)} de dano ${target}`;
    case 'buffAttribute': {
      const verb = isNegative(effect.magnitude) ? 'reduz' : 'aumenta';
      return `${verb} ${ATTRIBUTE_LABEL[effect.attribute]} em ${magnitudeText(effect.magnitude)} ${target}`;
    }
    case 'dispel':
      return `remove status ${target}`;
  }
}

/** The ability's primary effect, described in one short clause — empty string if it has none (shouldn't happen for authored data). */
export function describeAbilityEffect(ability: AbilityDefinition): string {
  const [primary] = ability.effects;
  return primary ? describeEffect(primary) : '';
}
