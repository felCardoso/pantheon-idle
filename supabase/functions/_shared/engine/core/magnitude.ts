// AUTO-GENERATED from src/engine — DO NOT EDIT BY HAND.
// Run `npm run sync:pvp-engine` after changing the engine.
// See scripts/sync-pvp-engine.mjs for why this copy exists.
import type { Magnitude } from '../schema.ts';
import type { Combatant } from './types.ts';
import type { TriggerContext } from './context.ts';

/**
 * Magnitude resolution — how an effect's numeric strength is computed.
 *
 * Same lookup-table shape as targeting.ts: add a variant to schema.ts's
 * Magnitude union and a resolver here; the Record type makes the pair
 * mandatory. Note that some kinds read the TARGET (percentOfMaxHp) and others
 * the CASTER (percentOfBaseAtk), which is why both are passed in.
 */

type Resolver<K extends Magnitude['kind']> = (magnitude: Extract<Magnitude, { kind: K }>, ctx: TriggerContext, target: Combatant) => number;

type ResolverMap = { [K in Magnitude['kind']]: Resolver<K> };

const RESOLVERS: ResolverMap = {
  flat: (m) => m.value,
  percent: (m) => m.value,
  percentOfMaxHp: (m, _ctx, target) => m.percent * target.maxHp,
  /** Scales with the caster's star level, so one definition covers every upgrade tier. */
  percentOfBaseAtk: (m, ctx) => (m.basePercent + (m.perStarBonus ?? 0) * ctx.self.stars) * ctx.self.base.atk,
  /** Reuses the damage of the attack that caused this trigger (riposte-style kits). */
  triggeringDamage: (_m, ctx) => ctx.attackResult?.finalDamage ?? 0,
};

export function resolveMagnitude(magnitude: Magnitude, ctx: TriggerContext, target: Combatant): number {
  const resolve = RESOLVERS[magnitude.kind] as Resolver<Magnitude['kind']>;
  return resolve(magnitude, ctx, target);
}
