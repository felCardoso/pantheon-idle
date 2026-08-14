import type { StatusType } from './schema.ts';
import type { Combatant, StatusEffectInstance } from './types.ts';

function sumActive(c: Combatant, status: StatusType): number {
  return c.statuses.filter((s) => s.status === status).reduce((sum, s) => sum + s.value, 0);
}

function sumActiveByKind(c: Combatant, status: StatusType, flat: boolean): number {
  return c.statuses.filter((s) => s.status === status && !!s.isFlat === flat).reduce((sum, s) => sum + s.value, 0);
}

export function effectiveAtk(c: Combatant): number {
  const reduction = sumActive(c, 'enfraquecimento');
  const buff = sumActive(c, 'buffAtk');
  return Math.max(0, c.base.atk * (1 - reduction) * (1 + buff));
}

/** Corrosão (docs/combate.md: "reduz DEF em X% ou valor mínimo") supports both a flat point reduction and a percent reduction, applied together — flat first, then percent. */
export function effectiveDef(c: Combatant): number {
  const flatReduction = sumActiveByKind(c, 'corrosao', true);
  const percentReduction = sumActiveByKind(c, 'corrosao', false);
  const buff = sumActive(c, 'buffDef');
  const afterFlat = Math.max(0, c.base.def - flatReduction);
  return Math.max(0, afterFlat * (1 - percentReduction) * (1 + buff));
}

export function effectiveIni(c: Combatant): number {
  const reduction = sumActive(c, 'lentidao');
  const buff = sumActive(c, 'buffIni');
  return Math.max(0, c.base.ini * (1 - reduction) * (1 + buff));
}

export function effectiveEsq(c: Combatant): number {
  const buff = sumActive(c, 'buffEsq');
  return Math.max(0, c.base.esq * (1 + buff));
}

export function effectiveIce(c: Combatant): number {
  // No status in the current roster modifies ICE; kept for API symmetry / future statuses.
  return c.base.ice;
}

export function isStunned(c: Combatant): boolean {
  return c.statuses.some((s) => s.status === 'atordoamento');
}

export function isMarked(c: Combatant): boolean {
  return c.statuses.some((s) => s.status === 'marcado');
}

/** Consumes (removes) a single Marcado instance, e.g. once its guaranteed crit has been used. */
export function consumeMark(c: Combatant): void {
  const idx = c.statuses.findIndex((s) => s.status === 'marcado');
  if (idx !== -1) c.statuses.splice(idx, 1);
}

function defaultIgnoresShield(status: StatusType): boolean {
  return status === 'veneno';
}

export interface ApplyStatusOptions {
  stacks?: boolean;
  ignoresShield?: boolean;
  isFlat?: boolean;
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
    isFlat: options.isFlat,
  };

  if (!options.stacks) {
    target.statuses = target.statuses.filter((s) => s.status !== status);
  }
  target.statuses.push(instance);
  return instance;
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

const DAMAGE_OVER_TIME: ReadonlySet<StatusType> = new Set(['virus', 'sangramento', 'veneno']);

/** Applies DOT/regen ticks for one round and ages down every status's remaining duration. */
export function endOfRoundTick(c: Combatant): EndOfRoundResult {
  const ticks: StatusTick[] = [];
  const expired: StatusType[] = [];
  const remaining: StatusEffectInstance[] = [];

  for (const s of c.statuses) {
    if (DAMAGE_OVER_TIME.has(s.status)) {
      const dmg = s.value;
      let fromShield = 0;
      if (s.ignoresShield) {
        c.hp = Math.max(0, c.hp - dmg);
      } else {
        fromShield = Math.min(c.shield, dmg);
        c.shield -= fromShield;
        c.hp = Math.max(0, c.hp - (dmg - fromShield));
      }
      ticks.push({ status: s.status, amount: dmg, kind: 'damage', shieldAbsorbed: fromShield });
    } else if (s.status === 'regeneracao') {
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
