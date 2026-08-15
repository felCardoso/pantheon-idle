import type { AbilityDefinition, AbilityEffect, AbilityTrigger, BuffableAttribute, Magnitude, StatusType, TargetSelector } from '../schema';
import type { AttackResult, BattleLogEntry, Combatant } from './types';
import type { RngLike } from './rng';
import { applyStatus, dispelStatuses, effectiveAtk, effectiveDef, effectiveEsq, effectiveIni } from './statusEffects';
import { CONSTANTS } from './loader';

export interface TriggerContext {
  self: Combatant;
  allies: Combatant[];
  enemies: Combatant[];
  rng: RngLike;
  log: (entry: BattleLogEntry) => void;
  /** onCounter: who attacked self. */
  attacker?: Combatant;
  /** onAttack / onCriticalHit: who self is attacking. */
  defender?: Combatant;
  /** The attack that caused this trigger, needed for the "triggeringDamage" magnitude. */
  attackResult?: AttackResult;
}

/** Picks the single living unit in `pool` that scores highest by `score` — first one wins ties, matching Array.reduce's stable left-to-right order. */
function pickExtreme(pool: Combatant[], score: (c: Combatant) => number, highest: boolean): Combatant[] {
  const living = pool.filter((c) => c.hp > 0);
  if (living.length === 0) return [];
  return [living.reduce((best, c) => (highest ? score(c) > score(best) : score(c) < score(best)) ? c : best)];
}

function resolveTargets(selector: TargetSelector, ctx: TriggerContext): Combatant[] {
  switch (selector) {
    case 'self':
      return [ctx.self];
    case 'attacker':
      return ctx.attacker ? [ctx.attacker] : [];
    case 'defender':
      return ctx.defender ? [ctx.defender] : [];
    case 'allAllies':
      return ctx.allies.filter((c) => c.hp > 0);
    case 'allEnemies':
      return ctx.enemies.filter((c) => c.hp > 0);
    case 'lowestHpAlly':
      return pickExtreme(ctx.allies, (c) => c.hp, false);
    case 'highestAtkAlly':
      return pickExtreme(ctx.allies, effectiveAtk, true);
    case 'frontAlly': {
      // Team-list order is the line-up/queue order (docs/combate.md §1) — the
      // first living ally in that order is the front of the queue.
      const front = ctx.allies.find((c) => c.hp > 0);
      return front ? [front] : [];
    }
    case 'randomAlly': {
      const living = ctx.allies.filter((c) => c.hp > 0);
      return living.length === 0 ? [] : [ctx.rng.pick(living)];
    }
    case 'lowestEsqEnemy':
      return pickExtreme(ctx.enemies, effectiveEsq, false);
    case 'highestIniEnemy':
      return pickExtreme(ctx.enemies, effectiveIni, true);
    case 'randomEnemy': {
      const living = ctx.enemies.filter((c) => c.hp > 0);
      return living.length === 0 ? [] : [ctx.rng.pick(living)];
    }
  }
}

function resolveMagnitude(magnitude: Magnitude, ctx: TriggerContext, target: Combatant): number {
  switch (magnitude.kind) {
    case 'flat':
      return magnitude.value;
    case 'percent':
      return magnitude.value;
    case 'percentOfMaxHp':
      return magnitude.percent * target.maxHp;
    case 'percentOfBaseAtk': {
      const percent = magnitude.basePercent + (magnitude.perStarBonus ?? 0) * ctx.self.stars;
      return percent * ctx.self.base.atk;
    }
    case 'triggeringDamage':
      return ctx.attackResult?.finalDamage ?? 0;
  }
}

const BUFF_STATUS_BY_ATTRIBUTE: Record<BuffableAttribute, StatusType> = {
  atk: 'buffAtk',
  def: 'buffDef',
  ini: 'buffIni',
  esq: 'buffEsq',
  ice: 'buffIce',
};

/** Fires ctx-relative triggers for a target that just received shield/heal — reuses ctx's own team topology, which is correct whenever the target is on the same side as ctx.self (always true for grantShield/heal, the only effects that call this). */
function fireReceivedTriggers(trigger: 'onShieldReceived' | 'onHealReceived', target: Combatant, ctx: TriggerContext): void {
  fireTrigger(trigger, { self: target, allies: ctx.allies, enemies: ctx.enemies, rng: ctx.rng, log: ctx.log });
}

/**
 * "ao morrer" / "ao perder 50% da vida" / "quando escudo quebra" fire from
 * multiple, structurally different call sites (a basic attack in battle.ts,
 * an ability's directDamage effect right here, DoT ticks, ICE reflects,
 * enrage true damage) — these three are shared exports rather than private
 * to one module so every damage path fires them the same way, given
 * whichever allies/enemies pair is correct for the affected unit's own side.
 */
export function fireDeath(unit: Combatant, allies: Combatant[], enemies: Combatant[], rng: RngLike, log: (entry: BattleLogEntry) => void): void {
  fireTrigger('onDeath', { self: unit, allies, enemies, rng, log });
}

/** Fires once, the first time `unit`'s HP crosses below half its max; never re-fires on a later heal-then-redrop. */
export function maybeFireHalfHp(unit: Combatant, allies: Combatant[], enemies: Combatant[], rng: RngLike, log: (entry: BattleLogEntry) => void): void {
  if (unit.halfHpTriggered || unit.hp <= 0 || unit.hp > unit.maxHp * 0.5) return;
  unit.halfHpTriggered = true;
  fireTrigger('onHalfHp', { self: unit, allies, enemies, rng, log });
}

/** Call with the shield value from just before whatever drained it. */
export function maybeFireShieldBreak(
  unit: Combatant,
  shieldBefore: number,
  allies: Combatant[],
  enemies: Combatant[],
  rng: RngLike,
  log: (entry: BattleLogEntry) => void,
): void {
  if (shieldBefore <= 0 || unit.shield > 0) return;
  fireTrigger('onShieldBreak', { self: unit, allies, enemies, rng, log });
}

/** Which allies/enemies list `target` itself belongs to, given the perspective of `ctx` (ctx.self's own team) — needed because an ability effect can target either side (self/allies vs. an enemy), and the death/half-HP/shield-break triggers need to fire from the *target's* own perspective, not the caster's. */
function teamContextFor(target: Combatant, ctx: TriggerContext): { allies: Combatant[]; enemies: Combatant[] } {
  return ctx.allies.includes(target) ? { allies: ctx.allies, enemies: ctx.enemies } : { allies: ctx.enemies, enemies: ctx.allies };
}

function applyEffect(effect: AbilityEffect, ctx: TriggerContext): void {
  const targets = resolveTargets(effect.target, ctx).filter((t) => t.hp > 0);

  for (const target of targets) {
    switch (effect.type) {
      case 'applyStatus': {
        const duration = effect.duration === 'default' ? CONSTANTS.statusDefaultDurations[effect.status] : effect.duration;
        const value = resolveMagnitude(effect.magnitude, ctx, target);
        applyStatus(target, ctx.self, effect.status, duration, value, {
          stacks: effect.stacks,
          ignoresShield: effect.ignoresShield,
        });
        ctx.log({ kind: 'statusApplied', target: target.name, status: effect.status, source: ctx.self.name, rounds: duration });
        break;
      }
      case 'heal': {
        const amount = Math.round(Math.min(resolveMagnitude(effect.magnitude, ctx, target), target.maxHp - target.hp));
        target.hp += amount;
        ctx.log({ kind: 'heal', target: target.name, amount, source: ctx.self.name });
        if (amount > 0) fireReceivedTriggers('onHealReceived', target, ctx);
        break;
      }
      case 'grantShield': {
        const amount = Math.round(resolveMagnitude(effect.magnitude, ctx, target));
        target.shield += amount;
        ctx.log({ kind: 'shieldGranted', target: target.name, amount, source: ctx.self.name });
        if (amount > 0) {
          fireReceivedTriggers('onShieldReceived', target, ctx);
          for (const ally of ctx.allies.filter((a) => a !== target && a.hp > 0)) {
            fireTrigger('onAllyShieldReceived', { self: ally, allies: ctx.allies, enemies: ctx.enemies, rng: ctx.rng, log: ctx.log });
          }
        }
        break;
      }
      case 'directDamage': {
        const raw = resolveMagnitude(effect.magnitude, ctx, target);
        const mitigated = effect.ignoresDef ? raw : raw * (1 - effectiveDef(target));
        const damage = Math.max(0, Math.round(mitigated));
        const shieldBefore = target.shield;
        let shieldAbsorbed = 0;
        let hpDamage = damage;
        if (!effect.ignoresShield && target.shield > 0) {
          shieldAbsorbed = Math.min(target.shield, damage);
          target.shield -= shieldAbsorbed;
          hpDamage = damage - shieldAbsorbed;
        }
        target.hp = Math.max(0, target.hp - hpDamage);
        const targetDied = target.hp <= 0;
        ctx.log({ kind: 'directDamage', target: target.name, source: ctx.self.name, amount: damage, shieldAbsorbed, hpDamage, targetDied });
        const { allies: tAllies, enemies: tEnemies } = teamContextFor(target, ctx);
        maybeFireShieldBreak(target, shieldBefore, tAllies, tEnemies, ctx.rng, ctx.log);
        if (targetDied) fireDeath(target, tAllies, tEnemies, ctx.rng, ctx.log);
        else maybeFireHalfHp(target, tAllies, tEnemies, ctx.rng, ctx.log);
        break;
      }
      case 'buffAttribute': {
        const status = BUFF_STATUS_BY_ATTRIBUTE[effect.attribute];
        const duration =
          effect.duration === 'permanent' ? null : effect.duration === 'default' ? CONSTANTS.statusDefaultDurations[status] : effect.duration;
        const value = resolveMagnitude(effect.magnitude, ctx, target);
        applyStatus(target, ctx.self, status, duration, value, { stacks: true });
        ctx.log({ kind: 'statusApplied', target: target.name, status, source: ctx.self.name, rounds: duration });
        break;
      }
      case 'dispel': {
        const removed = dispelStatuses(target, effect.statuses);
        for (const status of removed) {
          ctx.log({ kind: 'statusExpired', target: target.name, status });
        }
        break;
      }
    }
  }
}

/** Fires every ability `ctx.self` owns that listens for `trigger`, rolling each one's chance independently. */
export function fireTrigger(trigger: AbilityTrigger, ctx: TriggerContext): void {
  for (const ability of ctx.self.abilities) {
    if (ability.trigger !== trigger) continue;
    if (ability.chance !== undefined && !ctx.rng.chance(ability.chance)) continue;
    for (const effect of ability.effects) {
      applyEffect(effect, ctx);
    }
  }
}

export type { AbilityDefinition };
