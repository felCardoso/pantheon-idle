// AUTO-GENERATED from src/engine — DO NOT EDIT BY HAND.
// Run `npm run sync:pvp-engine` after changing the source.
// See scripts/sync-pvp-engine.mjs for why this copy exists.
import type { BuffableAttribute, StatusType } from '../schema.ts';
import type { Combatant, StatusEffectInstance } from './types.ts';
import { STATUS_REGISTRY, modifiersFor, statusIgnoresShield, statusesOfKind } from './statusRegistry.ts';

/**
 * Status arithmetic and lifecycle. Every behavioural question ("is this a
 * DOT?", "does it bypass shields?", "which stat does it move?") is answered by
 * statusRegistry.ts — this module only applies the math, so adding a status
 * never requires touching it.
 */

function sumActive(c: Combatant, status: StatusType): number {
  return c.statuses.filter((s) => s.status === status).reduce((sum, s) => sum + s.value, 0);
}

/**
 * Effective value of one base stat after every active modifier.
 *
 * Reductions and multipliers compose as `base * (1 - reductions) * (1 + multipliers)`,
 * which is what makes Throttling (-ATK%) and a +ATK% buff stack sensibly
 * instead of cancelling to a flat sum.
 */
function effectiveStat(c: Combatant, attribute: BuffableAttribute): number {
  const { multipliers, reductions } = modifiersFor(attribute);
  const reduction = reductions.reduce((sum, s) => sum + sumActive(c, s), 0);
  const buff = multipliers.reduce((sum, s) => sum + sumActive(c, s), 0);
  return Math.max(0, c.base[attribute] * (1 - reduction) * (1 + buff));
}

export function effectiveAtk(c: Combatant): number {
  return effectiveStat(c, 'atk');
}

/**
 * Firewall, capped at 0.9 (90% mitigation). DEF is a *fraction of damage
 * ignored* and damage.ts computes `rawDamage * (1 - effectiveDef)` — an
 * uncapped value at or above 1 flips that negative, which would read as the
 * attack healing its target.
 */
export function effectiveDef(c: Combatant): number {
  return Math.min(0.9, effectiveStat(c, 'def'));
}

/** Ping — feeds attackIntervalFor() in schema.ts. Never an ordering key. */
export function effectiveVel(c: Combatant): number {
  return effectiveStat(c, 'vel');
}

export function effectiveEsq(c: Combatant): number {
  return effectiveStat(c, 'esq');
}

export function effectiveIce(c: Combatant): number {
  return effectiveStat(c, 'ice');
}

/** Crash — "interrompendo sua ação atual e impedindo ataques por X segundos". */
export function isStunned(c: Combatant): boolean {
  return c.statuses.some((s) => s.status === 'crash');
}

export function isMarked(c: Combatant): boolean {
  return c.statuses.some((s) => s.status === 'target');
}

/** Consumes (removes) a single Target instance, once its guaranteed crit has been used. */
export function consumeMark(c: Combatant): void {
  const idx = c.statuses.findIndex((s) => s.status === 'target');
  if (idx !== -1) c.statuses.splice(idx, 1);
}

export interface ApplyStatusOptions {
  stacks?: boolean;
  ignoresShield?: boolean;
  /** Marks this instance as owned by a benched unit, so it can be detached when that unit rotates in. */
  benchSourceId?: string;
}

/**
 * Applies a status to `target`, attributing it to `source` so Jurupari.exe's
 * passive (+N seconds to statuses *he* applies) can extend the duration.
 *
 * `baseDurationSeconds` is in SECONDS; null means "no timer" — Target (consumed
 * by the next hit), permanent buffs, and bench-held buffs.
 */
export function applyStatus(
  target: Combatant,
  source: Combatant,
  status: StatusType,
  baseDurationSeconds: number | null,
  value: number,
  options: ApplyStatusOptions = {},
): StatusEffectInstance {
  const remainingSeconds = baseDurationSeconds === null ? null : baseDurationSeconds + source.statusDurationBonus;
  const instance: StatusEffectInstance = {
    status,
    remainingSeconds,
    value,
    ignoresShield: options.ignoresShield ?? statusIgnoresShield(status),
    benchSourceId: options.benchSourceId,
    tickAccumulator: 0,
  };

  const stacks = options.stacks ?? STATUS_REGISTRY[status].stacksByDefault ?? false;
  if (!stacks) {
    target.statuses = target.statuses.filter((s) => s.status !== status);
  }
  target.statuses.push(instance);
  return instance;
}

/** Removes every status attached by `benchSourceId` — called when that unit stops being benched. */
export function detachBenchStatuses(target: Combatant, benchSourceId: string): StatusType[] {
  const removed = target.statuses.filter((s) => s.benchSourceId === benchSourceId).map((s) => s.status);
  target.statuses = target.statuses.filter((s) => s.benchSourceId !== benchSourceId);
  return removed;
}

/** True if `target` already carries a status attached by this bench owner — keeps `constant` bench abilities idempotent instead of re-stacking every tick. */
export function hasBenchStatusFrom(target: Combatant, benchSourceId: string): boolean {
  return target.statuses.some((s) => s.benchSourceId === benchSourceId);
}

/** "Quebra direta de status inimigo" — strips the given statuses (or whichever bucket the target has active, if omitted) from `target`. Returns the removed status types. */
export function dispelStatuses(target: Combatant, statuses?: StatusType[]): StatusType[] {
  const debuffs = statusesOfKind('debuff');
  const toStrip = statuses ?? (target.statuses.some((s) => debuffs.includes(s.status)) ? debuffs : statusesOfKind('buff'));
  const removed = target.statuses.filter((s) => toStrip.includes(s.status)).map((s) => s.status);
  target.statuses = target.statuses.filter((s) => !toStrip.includes(s.status));
  return removed;
}

/**
 * How much of `damage` the target's shield absorbs, and how much spills to
 * HP. Fragmentação ("multiplica o dano causado contra Escudos") inflates how
 * much shield a point of damage costs to absorb — the portion of `damage` a
 * full shield can cover shrinks, so more spills to HP than it normally would;
 * the total damage dealt is unchanged.
 */
export function absorbIntoShield(target: Combatant, damage: number, ignoresShield?: boolean): { shieldAbsorbed: number; hpDamage: number } {
  if (ignoresShield || target.shield <= 0) return { shieldAbsorbed: 0, hpDamage: damage };
  const fragMultiplier = 1 + sumActive(target, 'fragmentation');
  const shieldDrawn = Math.min(target.shield, damage * fragMultiplier);
  const shieldAbsorbed = shieldDrawn / fragMultiplier;
  target.shield -= shieldDrawn;
  return { shieldAbsorbed, hpDamage: damage - shieldAbsorbed };
}

export interface StatusTick {
  status: StatusType;
  amount: number;
  kind: 'damage' | 'heal';
  shieldAbsorbed: number;
}

export interface StatusTickResult {
  ticks: StatusTick[];
  expired: StatusType[];
}

/**
 * Advances every status on `c` by `deltaSeconds`.
 *
 * DOT/HOT values are defined per SECOND (§4: "Dano fixo por segundo") while
 * the simulation steps in sub-second ticks — so each instance carries an
 * accumulator and only pays out on whole-second boundaries. That keeps a Leak
 * worth 10/s dealing exactly 10 per second regardless of tick granularity,
 * instead of scaling with how finely we happen to step time.
 *
 * Statuses whose duration is null (Target, permanent buffs, bench-held buffs)
 * never age down here.
 */
export function tickStatuses(c: Combatant, deltaSeconds: number): StatusTickResult {
  const ticks: StatusTick[] = [];
  const expired: StatusType[] = [];
  const remaining: StatusEffectInstance[] = [];

  for (const s of c.statuses) {
    const behaviour = STATUS_REGISTRY[s.status].tick;

    if (behaviour !== 'none') {
      let acc = (s.tickAccumulator ?? 0) + deltaSeconds;
      while (acc >= 1) {
        acc -= 1;
        if (behaviour === 'damage') {
          const { shieldAbsorbed } = absorbIntoShield(c, s.value, s.ignoresShield);
          c.hp = Math.max(0, c.hp - (s.value - shieldAbsorbed));
          ticks.push({ status: s.status, amount: s.value, kind: 'damage', shieldAbsorbed });
        } else {
          const heal = Math.min(s.value, c.maxHp - c.hp);
          c.hp += heal;
          ticks.push({ status: s.status, amount: heal, kind: 'heal', shieldAbsorbed: 0 });
        }
      }
      s.tickAccumulator = acc;
    }

    if (s.remainingSeconds === null) {
      remaining.push(s);
      continue;
    }
    const next = s.remainingSeconds - deltaSeconds;
    // Epsilon guards against float drift turning an exact 4.0s duration into
    // 3.9999...s and silently granting an extra tick.
    if (next <= 1e-9) {
      expired.push(s.status);
    } else {
      remaining.push({ ...s, remainingSeconds: next });
    }
  }

  c.statuses = remaining;
  return { ticks, expired };
}
