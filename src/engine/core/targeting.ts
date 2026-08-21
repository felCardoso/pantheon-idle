import type { TargetSelector } from '../schema';
import type { Combatant } from './types';
import type { TriggerContext } from './context';
import { effectiveAtk, effectiveEsq } from './statusEffects';

/**
 * Target resolution — "Alvos Possíveis" from docs/combate.md v3.1.
 *
 * Implemented as a lookup table rather than a switch so adding a selector is
 * a single new entry: declare the key in schema.ts's TargetSelector union and
 * add its resolver here. TypeScript's Record type makes a missing entry a
 * compile error, so the two can never drift apart.
 */

type Resolver = (ctx: TriggerContext) => Combatant[];

const living = (units: Combatant[]): Combatant[] => units.filter((c) => c.hp > 0);

/**
 * Formation support for the turn engine (src/engine/turn/types.ts's TurnCombatant), reached
 * structurally rather than by importing anything turn-specific: if the pool's units carry a
 * `row` field, single-target selectors below only see the front row while it has a living
 * member, else the back row. Plain PvE Combatants never carry `row`, so this is a no-op for the
 * real-time engine — same living() result as before, byte for byte.
 *
 * Deliberately NOT applied inside living() itself: allAllies/allEnemies (area effects) and
 * benchAllies must see every living unit regardless of row — row-restriction only makes sense
 * for a selector that picks exactly one target.
 */
function livingTargetable(units: Combatant[]): Combatant[] {
  const alive = living(units);
  const withRow = alive as (Combatant & { row?: 'front' | 'back' })[];
  if (withRow.length === 0 || withRow[0].row === undefined) return alive;
  const front = withRow.filter((c) => c.row === 'front');
  return front.length > 0 ? front : withRow.filter((c) => c.row === 'back');
}

/** The living unit at the front of a queue — that side's current Vanguard. */
export function vanguardOf(queue: Combatant[]): Combatant | undefined {
  return queue.find((c) => c.hp > 0);
}

/** Single living (and, in turn mode, row-targetable) unit scoring highest (or lowest) by `score`. First wins ties, matching reduce's stable left-to-right order. */
function pickExtreme(pool: Combatant[], score: (c: Combatant) => number, highest: boolean): Combatant[] {
  const alive = livingTargetable(pool);
  if (alive.length === 0) return [];
  return [alive.reduce((best, c) => ((highest ? score(c) > score(best) : score(c) < score(best)) ? c : best))];
}

const one = (c: Combatant | undefined): Combatant[] => (c ? [c] : []);

const RESOLVERS: Record<TargetSelector, Resolver> = {
  self: (ctx) => [ctx.self],
  attacker: (ctx) => one(ctx.attacker),
  defender: (ctx) => one(ctx.defender),
  chosenTarget: (ctx) => one(ctx.chosenTarget),

  ownVanguard: (ctx) => one(vanguardOf(ctx.allies)),
  enemyVanguard: (ctx) => one(vanguardOf(ctx.enemies)),
  /** The reserve — everyone alive on your side except the Vanguard. */
  benchAllies: (ctx) => {
    const front = vanguardOf(ctx.allies);
    return living(ctx.allies).filter((c) => c !== front);
  },

  allAllies: (ctx) => living(ctx.allies),
  allEnemies: (ctx) => living(ctx.enemies),

  lowestHpAlly: (ctx) => pickExtreme(ctx.allies, (c) => c.hp, false),
  highestAtkAlly: (ctx) => pickExtreme(ctx.allies, effectiveAtk, true),
  randomAlly: (ctx) => {
    const alive = livingTargetable(ctx.allies);
    return alive.length === 0 ? [] : [ctx.rng.pick(alive)];
  },

  lowestEsqEnemy: (ctx) => pickExtreme(ctx.enemies, effectiveEsq, false),
  /** Arachne.exe: "aplica Crash no processo de maior ATK inimigo" (§7B). */
  highestAtkEnemy: (ctx) => pickExtreme(ctx.enemies, effectiveAtk, true),
  /** Ogum.exe: "dano massivo focado no alvo de menor HP restante" (§7B). */
  lowestHpEnemy: (ctx) => pickExtreme(ctx.enemies, (c) => c.hp, false),
  randomEnemy: (ctx) => {
    const alive = livingTargetable(ctx.enemies);
    return alive.length === 0 ? [] : [ctx.rng.pick(alive)];
  },
};

export function resolveTargets(selector: TargetSelector, ctx: TriggerContext): Combatant[] {
  return RESOLVERS[selector](ctx);
}
