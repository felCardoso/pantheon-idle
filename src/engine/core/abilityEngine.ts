import type { AbilityDefinition, AbilityEffect, AbilityTrigger, BuffableAttribute, Magnitude, StatusType, TargetSelector } from '../schema';
import type { AttackResult, BattleLogEntry, Combatant } from './types';
import type { RngLike } from './rng';
import { absorbIntoShield, applyStatus, dispelStatuses, effectiveAtk, effectiveDef, effectiveEsq } from './statusEffects';
import { CONSTANTS } from './loader';

export interface TriggerContext {
  self: Combatant;
  /** self's own side, in queue order — index 0 is the Vanguard, the rest are benched. */
  allies: Combatant[];
  enemies: Combatant[];
  rng: RngLike;
  log: (entry: BattleLogEntry) => void;
  /** Simulation clock in seconds, stamped onto every log entry this trigger emits. */
  now: number;
  /** onCounter: who attacked self. */
  attacker?: Combatant;
  /** onAttack / onCriticalHit: who self is attacking. */
  defender?: Combatant;
  /** The attack that caused this trigger, needed for the "triggeringDamage" magnitude. */
  attackResult?: AttackResult;
  /**
   * Set while firing a BENCH ability: statuses it applies are tagged with this
   * id so they can be detached the moment its owner rotates into the Vanguard
   * (docs/combate.md v3.1 §1 — bench buffs last "apenas enquanto o dono
   * estiver inativo").
   */
  benchSourceId?: string;
}

/** Picks the single living unit in `pool` that scores highest by `score` — first one wins ties, matching Array.reduce's stable left-to-right order. */
function pickExtreme(pool: Combatant[], score: (c: Combatant) => number, highest: boolean): Combatant[] {
  const living = pool.filter((c) => c.hp > 0);
  if (living.length === 0) return [];
  return [living.reduce((best, c) => (highest ? score(c) > score(best) : score(c) < score(best)) ? c : best)];
}

/** The living unit at the front of `queue` — the side's current Vanguard. */
function vanguardOf(queue: Combatant[]): Combatant | undefined {
  return queue.find((c) => c.hp > 0);
}

function resolveTargets(selector: TargetSelector, ctx: TriggerContext): Combatant[] {
  switch (selector) {
    case 'self':
      return [ctx.self];
    case 'attacker':
      return ctx.attacker ? [ctx.attacker] : [];
    case 'defender':
      return ctx.defender ? [ctx.defender] : [];
    case 'ownVanguard': {
      const v = vanguardOf(ctx.allies);
      return v ? [v] : [];
    }
    case 'enemyVanguard': {
      const v = vanguardOf(ctx.enemies);
      return v ? [v] : [];
    }
    case 'benchAllies': {
      const front = vanguardOf(ctx.allies);
      return ctx.allies.filter((c) => c.hp > 0 && c !== front);
    }
    case 'allAllies':
      return ctx.allies.filter((c) => c.hp > 0);
    case 'allEnemies':
      return ctx.enemies.filter((c) => c.hp > 0);
    case 'lowestHpAlly':
      return pickExtreme(ctx.allies, (c) => c.hp, false);
    case 'highestAtkAlly':
      return pickExtreme(ctx.allies, effectiveAtk, true);
    case 'randomAlly': {
      const living = ctx.allies.filter((c) => c.hp > 0);
      return living.length === 0 ? [] : [ctx.rng.pick(living)];
    }
    case 'lowestEsqEnemy':
      return pickExtreme(ctx.enemies, effectiveEsq, false);
    case 'highestAtkEnemy':
      // Arachne.exe: "aplica Crash no processo de maior ATK inimigo" (§7B).
      return pickExtreme(ctx.enemies, effectiveAtk, true);
    case 'lowestHpEnemy':
      // Ogum.exe: "dano massivo focado automaticamente no alvo de menor HP restante" (§7B).
      return pickExtreme(ctx.enemies, (c) => c.hp, false);
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
  vel: 'buffVel',
  esq: 'buffEsq',
  ice: 'buffIce',
};

/** The "Echo" triggers — fire on the *caster's* other living allies when the caster successfully applies one of these 3 statuses to something. */
const ECHO_TRIGGER_BY_STATUS: Partial<Record<StatusType, AbilityTrigger>> = {
  trojan: 'onAllyAppliedTrojan',
  leak: 'onAllyAppliedLeak',
  crash: 'onAllyAppliedCrash',
};

/** Fires ctx-relative triggers for a target that just received shield/heal — reuses ctx's own team topology, which is correct whenever the target is on the same side as ctx.self (always true for grantShield/heal, the only effects that call this). */
function fireReceivedTriggers(trigger: 'onShieldReceived' | 'onHealReceived', target: Combatant, ctx: TriggerContext): void {
  fireTrigger(trigger, { self: target, allies: ctx.allies, enemies: ctx.enemies, rng: ctx.rng, log: ctx.log, now: ctx.now });
}

/** Broadcasts `trigger` to every one of `subject`'s living allies except `subject` itself — the shared "quando aliado X" fan-out used by every ally-reaction trigger. */
export function fireAllyBroadcast(
  trigger: AbilityTrigger,
  subject: Combatant,
  own: Combatant[],
  opposing: Combatant[],
  rng: RngLike,
  log: (entry: BattleLogEntry) => void,
  now: number,
): void {
  for (const ally of own.filter((a) => a !== subject && a.hp > 0)) {
    fireTrigger(trigger, { self: ally, allies: own, enemies: opposing, rng, log, now });
  }
}

/**
 * "ao morrer" / "ao perder 50% da vida" / "quando escudo quebra" / "ao sofrer
 * dano" fire from multiple, structurally different call sites (a basic attack
 * in battle.ts, an ability's directDamage effect right here, DoT ticks, ICE
 * reflects, System Overload true damage) — these shared exports (each also
 * broadcasting its "quando aliado..." pair) are exported rather than private
 * to one module so every damage path fires them the same way.
 */
export function fireDeath(
  unit: Combatant,
  allies: Combatant[],
  enemies: Combatant[],
  rng: RngLike,
  log: (entry: BattleLogEntry) => void,
  now: number,
): void {
  fireTrigger('onDeath', { self: unit, allies, enemies, rng, log, now });
  fireAllyBroadcast('onAllyDeath', unit, allies, enemies, rng, log, now);
}

/** Fires whenever `unit` just lost HP, from any source. Call whenever hpDamage > 0. */
export function fireOnWounded(
  unit: Combatant,
  allies: Combatant[],
  enemies: Combatant[],
  rng: RngLike,
  log: (entry: BattleLogEntry) => void,
  now: number,
): void {
  fireTrigger('onWounded', { self: unit, allies, enemies, rng, log, now });
  fireAllyBroadcast('onAllyWounded', unit, allies, enemies, rng, log, now);
}

/** Fires on `killer` when something it did ejected an opposing unit. */
export function fireOnKill(
  killer: Combatant,
  allies: Combatant[],
  enemies: Combatant[],
  rng: RngLike,
  log: (entry: BattleLogEntry) => void,
  now: number,
): void {
  fireTrigger('onKill', { self: killer, allies, enemies, rng, log, now });
}

/** Fires once, the first time `unit`'s HP crosses below half its max; never re-fires on a later heal-then-redrop. */
export function maybeFireHalfHp(
  unit: Combatant,
  allies: Combatant[],
  enemies: Combatant[],
  rng: RngLike,
  log: (entry: BattleLogEntry) => void,
  now: number,
): void {
  if (unit.halfHpTriggered || unit.hp <= 0 || unit.hp > unit.maxHp * 0.5) return;
  unit.halfHpTriggered = true;
  fireTrigger('onHalfHp', { self: unit, allies, enemies, rng, log, now });
}

/** Call with the shield value from just before whatever drained it. */
export function maybeFireShieldBreak(
  unit: Combatant,
  shieldBefore: number,
  allies: Combatant[],
  enemies: Combatant[],
  rng: RngLike,
  log: (entry: BattleLogEntry) => void,
  now: number,
): void {
  if (shieldBefore <= 0 || unit.shield > 0) return;
  fireTrigger('onShieldBreak', { self: unit, allies, enemies, rng, log, now });
  fireAllyBroadcast('onAllyShieldBreak', unit, allies, enemies, rng, log, now);
}

/** Which allies/enemies list `target` itself belongs to, given the perspective of `ctx` — an ability effect can target either side, and the death/half-HP/shield-break/wounded triggers must fire from the *target's* own perspective, not the caster's. */
function teamContextFor(target: Combatant, ctx: TriggerContext): { allies: Combatant[]; enemies: Combatant[] } {
  return ctx.allies.includes(target) ? { allies: ctx.allies, enemies: ctx.enemies } : { allies: ctx.enemies, enemies: ctx.allies };
}

function applyEffect(effect: AbilityEffect, ctx: TriggerContext): void {
  const targets = resolveTargets(effect.target, ctx).filter((t) => t.hp > 0);

  for (const target of targets) {
    switch (effect.type) {
      case 'applyStatus': {
        const seconds =
          effect.durationSeconds === 'default' ? CONSTANTS.statusDefaultDurations[effect.status] : effect.durationSeconds;
        const value = resolveMagnitude(effect.magnitude, ctx, target);
        applyStatus(target, ctx.self, effect.status, seconds, value, {
          stacks: effect.stacks,
          ignoresShield: effect.ignoresShield,
          benchSourceId: ctx.benchSourceId,
        });
        ctx.log({ at: ctx.now, kind: 'statusApplied', target: target.name, status: effect.status, source: ctx.self.name, seconds });
        const echoTrigger = ECHO_TRIGGER_BY_STATUS[effect.status];
        if (echoTrigger) fireAllyBroadcast(echoTrigger, ctx.self, ctx.allies, ctx.enemies, ctx.rng, ctx.log, ctx.now);
        break;
      }
      case 'heal': {
        const amount = Math.round(Math.min(resolveMagnitude(effect.magnitude, ctx, target), target.maxHp - target.hp));
        target.hp += amount;
        ctx.log({ at: ctx.now, kind: 'heal', target: target.name, amount, source: ctx.self.name });
        if (amount > 0) fireReceivedTriggers('onHealReceived', target, ctx);
        break;
      }
      case 'grantShield': {
        const amount = Math.round(resolveMagnitude(effect.magnitude, ctx, target));
        target.shield += amount;
        ctx.log({ at: ctx.now, kind: 'shieldGranted', target: target.name, amount, source: ctx.self.name });
        if (amount > 0) {
          fireReceivedTriggers('onShieldReceived', target, ctx);
          fireAllyBroadcast('onAllyShieldReceived', target, ctx.allies, ctx.enemies, ctx.rng, ctx.log, ctx.now);
        }
        break;
      }
      case 'directDamage': {
        // Ogum.exe (§7B): "quebra Escudos imediatamente" — the shield is gone
        // before mitigation, so the whole hit lands on Integridade.
        if (effect.breaksShield) target.shield = 0;
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
          const { allies: tAllies, enemies: tEnemies } = teamContextFor(target, ctx);
          maybeFireShieldBreak(target, shieldBefore, tAllies, tEnemies, ctx.rng, ctx.log, ctx.now);
          if (hpDamage > 0) fireOnWounded(target, tAllies, tEnemies, ctx.rng, ctx.log, ctx.now);
          if (targetDied) {
            fireDeath(target, tAllies, tEnemies, ctx.rng, ctx.log, ctx.now);
            fireOnKill(ctx.self, ctx.allies, ctx.enemies, ctx.rng, ctx.log, ctx.now);
          } else {
            maybeFireHalfHp(target, tAllies, tEnemies, ctx.rng, ctx.log, ctx.now);
          }
        }
        break;
      }
      case 'buffAttribute': {
        const status = BUFF_STATUS_BY_ATTRIBUTE[effect.attribute];
        const seconds =
          effect.durationSeconds === 'permanent'
            ? null
            : effect.durationSeconds === 'default'
              ? CONSTANTS.statusDefaultDurations[status]
              : effect.durationSeconds;
        const value = resolveMagnitude(effect.magnitude, ctx, target);
        // A bench buff is held open by its owner staying benched, not by a
        // timer, so it is attached with no duration and detached on rotation.
        const heldByBench = ctx.benchSourceId !== undefined;
        applyStatus(target, ctx.self, status, heldByBench ? null : seconds, value, {
          stacks: true,
          benchSourceId: ctx.benchSourceId,
        });
        ctx.log({ at: ctx.now, kind: 'statusApplied', target: target.name, status, source: ctx.self.name, seconds: heldByBench ? null : seconds });
        break;
      }
      case 'dispel': {
        const removed = dispelStatuses(target, effect.statuses);
        for (const status of removed) {
          ctx.log({ at: ctx.now, kind: 'statusExpired', target: target.name, status });
        }
        break;
      }
    }
  }
}

/**
 * Which of `unit`'s abilities are eligible to fire right now, by scope
 * (docs/combate.md v3.1 §3):
 * - passive: always
 * - active: only while it is the Vanguard
 * - bench: only while it is benched
 */
export function eligibleAbilities(unit: Combatant): AbilityDefinition[] {
  return unit.isVanguard ? [...unit.passiveAbilities, ...unit.activeAbilities] : [...unit.passiveAbilities, ...unit.benchAbilities];
}

/** Fires every eligible ability `ctx.self` owns that listens for `trigger`, rolling each one's chance independently. */
export function fireTrigger(trigger: AbilityTrigger, ctx: TriggerContext): void {
  for (const ability of eligibleAbilities(ctx.self)) {
    if (ability.trigger !== trigger) continue;
    if (ability.chance !== undefined && !ctx.rng.chance(ability.chance)) continue;
    fireAbility(ability, ctx);
  }
}

/** Runs one specific ability's effects. Exported so battle.ts can drive cooldown-based (`constant`) abilities directly without re-matching a trigger. */
export function fireAbility(ability: AbilityDefinition, ctx: TriggerContext): void {
  if (ability.scope !== 'passive') {
    ctx.log({ at: ctx.now, kind: 'abilityUsed', unit: ctx.self.name, abilityId: ability.id, abilityName: ability.name, scope: ability.scope });
  }
  for (const effect of ability.effects) {
    applyEffect(effect, ctx);
  }
}

export type { AbilityDefinition };
