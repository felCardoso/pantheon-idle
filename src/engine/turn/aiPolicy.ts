import type { AbilityDefinition } from '../schema';
import { isAbilityUsable } from './abilityEngine';
import { targetableRow } from './formation';
import type { TurnAction, TurnCombatant } from './types';

/**
 * The defending side is never online to make live choices (PvP stays asynchronous — see
 * docs/gdd.md section 6), so it needs a deterministic stand-in. This is a legible v1 heuristic,
 * not matchmaking-quality play: use the equipped active ability whenever it's off cooldown and a
 * legal target exists, otherwise basic-attack the lowest-HP legal target. It is deliberately
 * small and swappable — the one place a smarter AI would slot in later, per the design plan.
 */

/** The order the AI activates its own living units in for one phase — lowest HP% first, so a unit close to dying gets to act (and maybe finish a foe, or just do something) before a later action might kill it first. */
export function orderEnemyUnits(units: TurnCombatant[]): TurnCombatant[] {
  return [...units].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
}

function lowestHp(pool: TurnCombatant[]): TurnCombatant | undefined {
  return pool.length === 0 ? undefined : pool.reduce((best, c) => (c.hp < best.hp ? c : best));
}

/**
 * Whether a chosenTarget ability is support-flavored (aim it at an ally) rather than
 * offense-flavored (aim it at an enemy) — there's no explicit "ally vs enemy" field on
 * AbilityEffect, so this infers it from the effect type. heal/grantShield/buffAttribute/dispel
 * are support in every kit authored today (src/engine/data/turnAbilities.json); directDamage/
 * applyStatus are damage/debuffs. Good enough for a legible v1 AI — a kit that broke this
 * pattern (e.g. a debuff expressed as a negative buffAttribute) would need a smarter classifier,
 * not a bigger one here.
 */
function isSupportAbility(ability: AbilityDefinition): boolean {
  const chosenTargetEffect = ability.effects.find((e) => e.target === 'chosenTarget');
  return chosenTargetEffect?.type === 'heal' || chosenTargetEffect?.type === 'grantShield' || chosenTargetEffect?.type === 'buffAttribute' || chosenTargetEffect?.type === 'dispel';
}

/** Decides one unit's action, given its own team and the team it's fighting. */
export function decideEnemyAction(unit: TurnCombatant, ownTeam: TurnCombatant[], opposingTeam: TurnCombatant[]): TurnAction {
  const legalEnemies = targetableRow(opposingTeam);
  const ability = unit.activeAbilities[0];

  if (ability && isAbilityUsable(unit, ability)) {
    // An ability that doesn't need a specific chosen target (e.g. targets allEnemies/self) is
    // always safe to fire; one that does needs a legal target to aim it at first.
    const usesChosenTarget = ability.effects.some((e) => e.target === 'chosenTarget');
    if (!usesChosenTarget) {
      return { type: 'ability' };
    }
    const pool = isSupportAbility(ability) ? targetableRow(ownTeam) : legalEnemies;
    const target = lowestHp(pool);
    if (target) return { type: 'ability', targetId: target.id };
  }

  const target = lowestHp(legalEnemies);
  return target ? { type: 'basicAttack', targetId: target.id } : { type: 'basicAttack' };
}
