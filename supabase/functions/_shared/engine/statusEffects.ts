import type { StatusType } from './schema.ts';
import type { Combatant, StatusEffectInstance } from './types.ts';

function sumActive(c: Combatant, status: StatusType): number {
  return c.statuses.filter((s) => s.status === status).reduce((sum, s) => sum + s.value, 0);
}

export function effectiveAtk(c: Combatant): number {
  const reduction = sumActive(c, 'throttling');
  const buff = sumActive(c, 'buffAtk');
  return Math.max(0, c.base.atk * (1 - reduction) * (1 + buff));
}

/**
 * No dedicated Firewall-reduction status exists in v2 — debuffing DEF beyond
 * Throttling/Lag is just a negative buffDef (see schema.ts's
 * BuffAttributeEffect doc comment). Capped at 0.9 (90% mitigation): DEF is a
 * fraction of damage ignored, and stacked buffDef applications must never
 * push it to/past 1.0 — damage.ts computes `rawDamage * (1 - effectiveDef)`,
 * and an uncapped value at or above 1 flips that negative, which reads as
 * the attack healing the target's shield/HP instead of damaging it.
 */
export function effectiveDef(c: Combatant): number {
  const buff = sumActive(c, 'buffDef');
  return Math.min(0.9, Math.max(0, c.base.def * (1 + buff)));
}

export function effectiveIni(c: Combatant): number {
  const reduction = sumActive(c, 'lag');
  const buff = sumActive(c, 'buffIni');
  return Math.max(0, c.base.ini * (1 - reduction) * (1 + buff));
}

export function effectiveEsq(c: Combatant): number {
  const buff = sumActive(c, 'buffEsq');
  return Math.max(0, c.base.esq * (1 + buff));
}

export function effectiveIce(c: Combatant): number {
  const buff = sumActive(c, 'buffIce');
  return Math.max(0, c.base.ice * (1 + buff));
}

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
}

/**
 * Applies a status to `target`, attributing it to `source` so Jurupari.exe's
 * passive (+1 round to statuses *he* applies) can extend the duration.
 * Non-stacking statuses replace any existing instance of the same type.
 */
export function applyStatus(
  target: Combatant,
  source: Combatant,
  status: StatusType,
  baseDuration: number | null,
  value: number,
  options: ApplyStatusOptions = {},
): StatusEffectInstance {
  const remainingRounds = baseDuration === null ? null : baseDuration + source.statusDurationBonus;
  const instance: StatusEffectInstance = {
    status,
    remainingRounds,
    value,
    ignoresShield: options.ignoresShield ?? defaultIgnoresShield(status),
  };

  if (!options.stacks) {
    target.statuses = target.statuses.filter((s) => s.status !== status);
  }
  target.statuses.push(instance);
  return instance;
}

/** The 6 malware/debuff statuses (Efeitos Disponíveis, docs/combate.md §3) — used to disambiguate an untargeted DispelEffect. */
export const DEBUFF_STATUSES: ReadonlySet<StatusType> = new Set(['leak', 'trojan', 'crash', 'fragmentation', 'throttling', 'lag']);

/** The 5 generic attribute-buff statuses — a negative value is a debuff (see effectiveDef), but the status *kind* itself is still "buff" for dispel-targeting purposes. */
export const BUFF_STATUSES: ReadonlySet<StatusType> = new Set(['buffAtk', 'buffDef', 'buffIni', 'buffEsq', 'buffIce']);

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
 * HP. Fragmentação ("multiplica o dano causado a Escudos") inflates how much
 * shield a point of damage costs to absorb — the portion of `damage` a full
 * shield can cover shrinks, so more spills to HP than it normally would; the
 * total damage dealt is unchanged.
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

export interface EndOfRoundResult {
  ticks: StatusTick[];
  expired: StatusType[];
}

const DAMAGE_OVER_TIME: ReadonlySet<StatusType> = new Set(['leak', 'trojan']);

/** Applies DOT/regen ticks for one round and ages down every status's remaining duration. */
export function endOfRoundTick(c: Combatant): EndOfRoundResult {
  const ticks: StatusTick[] = [];
  const expired: StatusType[] = [];
  const remaining: StatusEffectInstance[] = [];

  for (const s of c.statuses) {
    if (DAMAGE_OVER_TIME.has(s.status)) {
      const dmg = s.value;
      const { shieldAbsorbed, hpDamage } = absorbIntoShield(c, dmg, s.ignoresShield);
      c.hp = Math.max(0, c.hp - hpDamage);
      ticks.push({ status: s.status, amount: dmg, kind: 'damage', shieldAbsorbed });
    } else if (s.status === 'nanites') {
      const heal = Math.min(s.value, c.maxHp - c.hp);
      c.hp += heal;
      ticks.push({ status: s.status, amount: heal, kind: 'heal', shieldAbsorbed: 0 });
    }

    if (s.remainingRounds === null) {
      remaining.push(s);
      continue;
    }
    const nextRemaining = s.remainingRounds - 1;
    if (nextRemaining <= 0) {
      expired.push(s.status);
    } else {
      remaining.push({ ...s, remainingRounds: nextRemaining });
    }
  }

  c.statuses = remaining;
  return { ticks, expired };
}
