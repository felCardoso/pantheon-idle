import type { StatusType } from '../schema';
import type { Combatant, StatusEffectInstance } from './types';

const ATTRIBUTE_DEBUFFS: Record<'enfraquecimento' | 'corrosao' | 'lentidao', true> = {
  enfraquecimento: true,
  corrosao: true,
  lentidao: true,
};

function sumActive(c: Combatant, status: StatusType): number {
  return c.statuses.filter((s) => s.status === status).reduce((sum, s) => sum + s.value, 0);
}

export function effectiveAtk(c: Combatant): number {
  const reduction = ATTRIBUTE_DEBUFFS.enfraquecimento ? sumActive(c, 'enfraquecimento') : 0;
  return Math.max(0, c.base.atk * (1 - reduction));
}

export function effectiveDef(c: Combatant): number {
  const reduction = sumActive(c, 'corrosao');
  return Math.max(0, c.base.def * (1 - reduction));
}

export function effectiveIni(c: Combatant): number {
  const reduction = sumActive(c, 'lentidao');
  return Math.max(0, c.base.ini * (1 - reduction));
}

export function effectiveEsq(c: Combatant): number {
  // No status in the current roster modifies ESQ; kept for API symmetry / future statuses.
  return c.base.esq;
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

export interface StatusTick {
  status: StatusType;
  amount: number;
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
      if (s.ignoresShield) {
        c.hp = Math.max(0, c.hp - dmg);
      } else {
        const fromShield = Math.min(c.shield, dmg);
        c.shield -= fromShield;
        c.hp = Math.max(0, c.hp - (dmg - fromShield));
      }
      ticks.push({ status: s.status, amount: dmg });
    } else if (s.status === 'regeneracao') {
      const heal = Math.min(s.value, c.maxHp - c.hp);
      c.hp += heal;
      ticks.push({ status: s.status, amount: heal });
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
