// AUTO-GENERATED from src/engine — DO NOT EDIT BY HAND.
// Run `npm run sync:pvp-engine` after changing the source.
// See scripts/sync-pvp-engine.mjs for why this copy exists.
import type { AbilityDefinition } from '../schema.ts';
import { isAbilityUsable } from './abilityEngine.ts';
import { targetableRow } from './formation.ts';
import type { TurnAction, TurnCombatant } from './types.ts';

/**
 * A deterministic stand-in for a live player, used two ways: for PvP's defending side, which is
 * never online to make live choices (docs/gdd.md section 6), and for PvE's default "auto-played"
 * mode (both sides — the enemy wave/boss AND the player's own squad — decide their actions here,
 * so the whole fight can run start-to-finish in one call, matching the idle game's real-time
 * "watch it play out" pacing instead of demanding a manual choice every round). This is a legible
 * v1 heuristic, not matchmaking-quality play: use the equipped active ability whenever it's off
 * cooldown and a legal target exists, otherwise basic-attack the lowest-HP legal target. It is
 * deliberately small and swappable — the one place a smarter AI would slot in later.
 */

/** The order a side's units act in for one phase — lowest HP% first, so a unit close to dying gets to act (and maybe finish a foe, or just do something) before a later action might kill it first. */
export function orderEnemyUnits(units: TurnCombatant[]): TurnCombatant[] {
  return [...units].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
}

function lowestHp(pool: TurnCombatant[]): TurnCombatant | undefined {
  return pool.length === 0 ? undefined : pool.reduce((best, c) => (c.hp < best.hp ? c : best));
}

/**
 * Whether a chosenTarget ability is support-flavored (aim it at an ally) rather than
 * offense-flavored (aim it at an enemy) — there's no explicit "ally vs enemy" field on
 * AbilityEffect, so this infers it from the effect type. heal/grantShield/dispel are always
 * support; directDamage/applyStatus are always damage/debuffs. buffAttribute is the one
 * genuinely ambiguous case — schema.ts documents a negative magnitude as how an attribute
 * *debuff* (e.g. a boss's Firewall/def shred, see src/engine/data/turnAbilities.json's boss
 * kits) is expressed, so a statically-known-negative flat/percent magnitude reads as offense;
 * everything else (positive, or a magnitude kind that isn't statically known here) defaults to
 * support, the common case.
 */
function isSupportAbility(ability: AbilityDefinition): boolean {
  const effect = ability.effects.find((e) => e.target === 'chosenTarget');
  if (!effect) return false;
  if (effect.type === 'heal' || effect.type === 'grantShield' || effect.type === 'dispel') return true;
  if (effect.type === 'buffAttribute') {
    const m = effect.magnitude;
    if (m.kind === 'flat' || m.kind === 'percent') return m.value >= 0;
    return true;
  }
  return false;
}

/** Decides one unit's action, given its own team and the team it's fighting — side-agnostic, see the module comment above. */
export function decideAutoAction(unit: TurnCombatant, ownTeam: TurnCombatant[], opposingTeam: TurnCombatant[]): TurnAction {
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
