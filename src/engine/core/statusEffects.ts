import type { StatusType } from '../schema';
import type { Combatant, StatusEffectInstance } from './types';

function sumActive(c: Combatant, status: StatusType): number {
  return c.statuses.filter((s) => s.status === status).reduce((sum, s) => sum + s.value, 0);
}

export function effectiveAtk(c: Combatant): number {
  const reduction = sumActive(c, 'throttling');
  const buff = sumActive(c, 'buffAtk');
  return Math.max(0, c.base.atk * (1 - reduction) * (1 + buff));
}

/**
 * No dedicated Firewall-reduction status exists — debuffing DEF (i.e.
 * "Corrosão", docs/combate.md v3.1 §7) is just a negative buffDef, see
 * schema.ts's BuffAttributeEffect. Capped at 0.9 (90% mitigation): DEF is a
 * fraction of damage ignored, and stacked buffDef applications must never
 * push it to/past 1.0 — damage.ts computes `rawDamage * (1 - effectiveDef)`,
 * and an uncapped value at or above 1 flips that negative, which reads as
 * the attack healing the target's shield/HP instead of damaging it.
 */
export function effectiveDef(c: Combatant): number {
  const buff = sumActive(c, 'buffDef');
  return Math.min(0.9, Math.max(0, c.base.def * (1 + buff)));
}

/**
 * Ping. Lag ("reduz o Ping, diminuindo a Velocidade de Ataque", §4) is a
 * multiplicative reduction; buffVel is the generic bonus. Feeds
 * attackIntervalFor() in schema.ts — never used as an ordering key any more.
 */
export function effectiveVel(c: Combatant): number {
  const reduction = sumActive(c, 'lag');
  const buff = sumActive(c, 'buffVel');
  return Math.max(0, c.base.vel * (1 - reduction) * (1 + buff));
}

export function effectiveEsq(c: Combatant): number {
  const buff = sumActive(c, 'buffEsq');
  return Math.max(0, c.base.esq * (1 + buff));
}

export function effectiveIce(c: Combatant): number {
  const buff = sumActive(c, 'buffIce');
  return Math.max(0, c.base.ice * (1 + buff));
}

/** Crash — "interrompendo sua ação atual e impedindo ataques por X segundos" (§4). */
export function isStunned(c: Combatant): boolean {
  return c.statuses.some((s) => s.status === 'crash');
}

export function isMarked(c: Combatant): boolean {
  return c.statuses.some((s) => s.status === 'target');
}

/** Consumes (removes) a single Target instance, e.g. once its guaranteed crit has been used. */
export function consumeMark(c: Combatant): void {
  const idx = c.statuses.findIndex((s) => s.status === 'target');
  if (idx !== -1) c.statuses.splice(idx, 1);
}

function defaultIgnoresShield(status: StatusType): boolean {
  return status === 'trojan';
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
 * Non-stacking statuses replace any existing instance of the same type.
 *
 * `baseDurationSeconds` is in SECONDS; null means "no timer" (Target, which is
 * consumed by the next hit, and permanent buffs).
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
    ignoresShield: options.ignoresShield ?? defaultIgnoresShield(status),
    benchSourceId: options.benchSourceId,
    tickAccumulator: 0,
  };

  if (!options.stacks) {
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

/** The 6 malware/debuff statuses (§4) — used to disambiguate an untargeted DispelEffect. */
export const DEBUFF_STATUSES: ReadonlySet<StatusType> = new Set(['leak', 'trojan', 'crash', 'fragmentation', 'throttling', 'lag']);

/** The 5 generic attribute-buff statuses — a negative value is a debuff (see effectiveDef), but the status *kind* itself is still "buff" for dispel-targeting purposes. */
export const BUFF_STATUSES: ReadonlySet<StatusType> = new Set(['buffAtk', 'buffDef', 'buffVel', 'buffEsq', 'buffIce']);

/** "Quebra direta de status inimigo" — strips the given statuses (or whichever bucket the target has active, if omitted) from `target`. Returns the removed status types. */
export function dispelStatuses(target: Combatant, statuses?: StatusType[]): StatusType[] {
  const toStrip =
    statuses ?? (target.statuses.some((s) => DEBUFF_STATUSES.has(s.status)) ? [...DEBUFF_STATUSES] : [...BUFF_STATUSES]);
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

const DAMAGE_OVER_TIME: ReadonlySet<StatusType> = new Set(['leak', 'trojan']);

/**
 * Advances every status on `c` by `deltaSeconds`.
 *
 * DOT/HOT values are defined per SECOND (§4: "Dano fixo por segundo"), while
 * the simulation steps in sub-second ticks — so each instance carries an
 * accumulator and only pays out on whole-second boundaries. That keeps a Leak
 * worth 10/s dealing exactly 10 per second regardless of the engine's tick
 * granularity, instead of scaling with how finely we happen to step time.
 *
 * Statuses whose duration is null (Target, permanent buffs, bench-attached
 * buffs) never age down here.
 */
export function tickStatuses(c: Combatant, deltaSeconds: number): StatusTickResult {
  const ticks: StatusTick[] = [];
  const expired: StatusType[] = [];
  const remaining: StatusEffectInstance[] = [];

  for (const s of c.statuses) {
    const isDot = DAMAGE_OVER_TIME.has(s.status);
    const isHot = s.status === 'nanites';

    if (isDot || isHot) {
      let acc = (s.tickAccumulator ?? 0) + deltaSeconds;
      while (acc >= 1) {
        acc -= 1;
        if (isDot) {
          const dmg = s.value;
          const { shieldAbsorbed } = absorbIntoShield(c, dmg, s.ignoresShield);
          const hpDamage = dmg - shieldAbsorbed;
          c.hp = Math.max(0, c.hp - hpDamage);
          ticks.push({ status: s.status, amount: dmg, kind: 'damage', shieldAbsorbed });
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
