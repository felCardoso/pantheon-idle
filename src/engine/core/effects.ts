import type { AbilityEffect, AbilityTrigger, BuffableAttribute, StatusType } from '../schema';
import type { Combatant } from './types';
import type { EffectRuntime, TriggerContext } from './context';
import { teamContextFor } from './context';
import { resolveTargets } from './targeting';
import { resolveMagnitude } from './magnitude';
import { absorbIntoShield, applyStatus, dispelStatuses, effectiveDef } from './statusEffects';
import { CONSTANTS } from './loader';

/**
 * Effect execution — "Efeitos Disponíveis" from docs/combate.md v3.1.
 *
 * Each effect type is an independent handler in the EFFECT_HANDLERS table.
 * Adding one is closed-for-modification: declare its interface in schema.ts,
 * add it to the AbilityEffect union, and register a handler here — no existing
 * handler or switch statement changes. TypeScript's Record over the union's
 * `type` field makes a missing handler a compile error.
 *
 * Handlers never import abilityEngine.ts; anything that needs to cascade into
 * further triggers goes through the injected `rt: EffectRuntime` (see
 * context.ts) so there is no import cycle and handlers stay unit-testable.
 */

type Handler<K extends AbilityEffect['type']> = (
  effect: Extract<AbilityEffect, { type: K }>,
  target: Combatant,
  ctx: TriggerContext,
  rt: EffectRuntime,
) => void;

type HandlerMap = { [K in AbilityEffect['type']]: Handler<K> };

const BUFF_STATUS_BY_ATTRIBUTE: Record<BuffableAttribute, StatusType> = {
  atk: 'buffAtk',
  def: 'buffDef',
  vel: 'buffVel',
  esq: 'buffEsq',
  ice: 'buffIce',
};

/** Fires on the *caster's* other allies when it lands one of these 3 statuses. */
const ECHO_TRIGGER_BY_STATUS: Partial<Record<StatusType, AbilityTrigger>> = {
  trojan: 'onAllyAppliedTrojan',
  leak: 'onAllyAppliedLeak',
  crash: 'onAllyAppliedCrash',
};

/**
 * Resolves a duration field to seconds, expanding the "default" sentinel from
 * constants.json. Returns null for statuses with no timer at all (Target,
 * whose table entry is null — it is consumed by the next hit instead).
 */
function durationOf(value: number | 'default', status: StatusType): number | null {
  return value === 'default' ? CONSTANTS.statusDefaultDurations[status] : value;
}

const EFFECT_HANDLERS: HandlerMap = {
  applyStatus: (effect, target, ctx, rt) => {
    const seconds = durationOf(effect.durationSeconds, effect.status);
    const value = resolveMagnitude(effect.magnitude, ctx, target);
    applyStatus(target, ctx.self, effect.status, seconds, value, {
      stacks: effect.stacks,
      ignoresShield: effect.ignoresShield,
      benchSourceId: ctx.benchSourceId,
    });
    ctx.log({ at: ctx.now, kind: 'statusApplied', target: target.name, status: effect.status, source: ctx.self.name, seconds });

    const echo = ECHO_TRIGGER_BY_STATUS[effect.status];
    if (echo) rt.fireAllyBroadcast(echo, ctx.self, ctx.allies, ctx.enemies, ctx.rng, ctx.log, ctx.now);
  },

  heal: (effect, target, ctx, rt) => {
    const amount = Math.round(Math.min(resolveMagnitude(effect.magnitude, ctx, target), target.maxHp - target.hp));
    target.hp += amount;
    ctx.log({ at: ctx.now, kind: 'heal', target: target.name, amount, source: ctx.self.name });
    if (amount > 0) {
      rt.fireTrigger('onHealReceived', { ...ctx, self: target });
    }
  },

  grantShield: (effect, target, ctx, rt) => {
    const amount = Math.round(resolveMagnitude(effect.magnitude, ctx, target));
    target.shield += amount;
    ctx.log({ at: ctx.now, kind: 'shieldGranted', target: target.name, amount, source: ctx.self.name });
    if (amount > 0) {
      rt.fireTrigger('onShieldReceived', { ...ctx, self: target });
      rt.fireAllyBroadcast('onAllyShieldReceived', target, ctx.allies, ctx.enemies, ctx.rng, ctx.log, ctx.now);
    }
  },

  directDamage: (effect, target, ctx, rt) => {
    // Ogum.exe (§7B): "quebra Escudos imediatamente" — the shield is gone
    // before mitigation, so the whole hit lands on Integridade.
    if (effect.breaksShield) target.shield = 0;

    // Yamata-no-Orochi (§7B): "múltiplos hits sequenciais". Stops early if a
    // hit ejects the target, so the remainder isn't wasted on a corpse.
    const hits = Math.max(1, effect.hits ?? 1);
    for (let i = 0; i < hits && target.hp > 0; i++) {
      const raw = resolveMagnitude(effect.magnitude, ctx, target);
      const mitigated = effect.ignoresDef ? raw : raw * (1 - effectiveDef(target));
      const damage = Math.max(0, Math.round(mitigated));
      const shieldBefore = target.shield;
      const { shieldAbsorbed, hpDamage } = absorbIntoShield(target, damage, effect.ignoresShield);
      target.hp = Math.max(0, target.hp - hpDamage);
      const targetDied = target.hp <= 0;

      ctx.log({
        at: ctx.now,
        kind: 'directDamage',
        target: target.name,
        source: ctx.self.name,
        amount: damage,
        shieldAbsorbed,
        hpDamage,
        targetDied,
      });

      const { allies, enemies } = teamContextFor(target, ctx);
      rt.maybeFireShieldBreak(target, shieldBefore, allies, enemies, ctx.rng, ctx.log, ctx.now);
      if (hpDamage > 0) rt.fireOnWounded(target, allies, enemies, ctx.rng, ctx.log, ctx.now);
      if (targetDied) {
        rt.fireDeath(target, allies, enemies, ctx.rng, ctx.log, ctx.now);
        rt.fireOnKill(ctx.self, ctx.allies, ctx.enemies, ctx.rng, ctx.log, ctx.now);
      } else {
        rt.maybeFireHalfHp(target, allies, enemies, ctx.rng, ctx.log, ctx.now);
      }
    }
  },

  buffAttribute: (effect, target, ctx) => {
    const status = BUFF_STATUS_BY_ATTRIBUTE[effect.attribute];
    // A bench buff is held open by its owner staying benched, not by a timer,
    // so it is attached with no duration and detached on rotation instead.
    const heldByBench = ctx.benchSourceId !== undefined;
    const seconds =
      heldByBench || effect.durationSeconds === 'permanent' ? null : durationOf(effect.durationSeconds, status);
    const value = resolveMagnitude(effect.magnitude, ctx, target);

    applyStatus(target, ctx.self, status, seconds, value, { stacks: true, benchSourceId: ctx.benchSourceId });
    ctx.log({ at: ctx.now, kind: 'statusApplied', target: target.name, status, source: ctx.self.name, seconds });
  },

  dispel: (effect, target, ctx) => {
    for (const status of dispelStatuses(target, effect.statuses)) {
      ctx.log({ at: ctx.now, kind: 'statusExpired', target: target.name, status });
    }
  },
};

/** Applies one effect to every unit its selector resolves to. */
export function applyEffect(effect: AbilityEffect, ctx: TriggerContext, rt: EffectRuntime): void {
  const handler = EFFECT_HANDLERS[effect.type] as Handler<AbilityEffect['type']>;
  for (const target of resolveTargets(effect.target, ctx).filter((t) => t.hp > 0)) {
    handler(effect, target, ctx, rt);
  }
}
