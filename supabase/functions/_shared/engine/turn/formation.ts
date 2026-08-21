// AUTO-GENERATED from src/engine — DO NOT EDIT BY HAND.
// Run `npm run sync:pvp-engine` after changing the source.
// See scripts/sync-pvp-engine.mjs for why this copy exists.
import type { Combatant } from '../core/types.ts';
import type { TurnCombatant } from './types.ts';

/**
 * Row queries for callers OUTSIDE the ability-effect pipeline — basic attacks (resolved directly
 * via core/damage.ts's resolveAttack, not through a TargetSelector) and the AI's own target
 * choice (src/engine/turn/aiPolicy.ts). Ability effects don't need this module at all: their
 * TargetSelectors (lowestHpEnemy, randomAlly, etc.) are already row-aware transparently, via the
 * structural `row`-field check core/targeting.ts's pickExtreme/randomAlly/randomEnemy resolvers
 * do — see the comment there. Only allAllies/allEnemies-style area effects skip row entirely,
 * which is deliberate (AoE ignores formation).
 */

const living = (units: TurnCombatant[]): TurnCombatant[] => units.filter((c) => c.hp > 0);

/** Living units in `pool` a single-target action may legally hit right now: the front row while
 * it has anyone alive, else the whole back row. */
export function targetableRow(pool: Combatant[]): TurnCombatant[] {
  const units = pool as TurnCombatant[];
  const front = living(units).filter((c) => c.row === 'front');
  if (front.length > 0) return front;
  return living(units).filter((c) => c.row === 'back');
}

export function targetableAllies(allies: Combatant[]): TurnCombatant[] {
  return targetableRow(allies);
}

export function targetableEnemies(enemies: Combatant[]): TurnCombatant[] {
  return targetableRow(enemies);
}

/** True if `chosen` is alive and in the currently-targetable row of `pool` — the legality check roundLoop.ts runs before letting a basic attack or ability land on a player/AI-picked target. */
export function isLegalSingleTarget(chosen: Combatant, pool: Combatant[]): boolean {
  return targetableRow(pool).some((c) => c.id === chosen.id);
}
