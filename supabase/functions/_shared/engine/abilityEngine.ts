import type { AbilityDefinition, AbilityEffect, AbilityTrigger, Magnitude, TargetSelector } from './schema.ts';
import type { AttackResult, BattleLogEntry, Combatant } from './types.ts';
import type { RngLike } from './rng.ts';
import { applyStatus } from './statusEffects.ts';
import { CONSTANTS } from './loader.ts';

export interface TriggerContext {
  self: Combatant;
  allies: Combatant[];
  enemies: Combatant[];
  rng: RngLike;
  log: (entry: BattleLogEntry) => void;
  /** onDamaged: who attacked self. */
  attacker?: Combatant;
  /** onAttack / onCriticalHit: who self is attacking. */
  defender?: Combatant;
  /** The attack that caused this trigger, needed for the "triggeringDamage" magnitude. */
  attackResult?: AttackResult;
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
        break;
      }
      case 'grantShield': {
        const amount = Math.round(resolveMagnitude(effect.magnitude, ctx, target));
        target.shield += amount;
        ctx.log({ kind: 'shieldGranted', target: target.name, amount, source: ctx.self.name });
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
