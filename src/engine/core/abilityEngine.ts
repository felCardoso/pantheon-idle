import type { AbilityDefinition, AbilityEffect, AbilityTrigger, BuffableAttribute, Magnitude, StatusType, TargetSelector } from '../schema';
import type { AttackResult, BattleLogEntry, Combatant } from './types';
import type { RngLike } from './rng';
import { absorbIntoShield, applyStatus, dispelStatuses, effectiveAtk, effectiveDef, effectiveEsq, effectiveIni } from './statusEffects';
import { CONSTANTS } from './loader';

export interface TriggerContext {
  self: Combatant;
  /**
   * self's own side, in line-up/queue order (front = index 0) — the battle
   * loop's ally/enemy arrays ARE the live queues, reordered as clashes
   * resolve, so this doubles as both "who's on my team" and "what order are
   * they queued in" (needed for the `frontAlly` target and Proxy Defense).
   */
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
      // ctx.allies is queue-ordered (front = index 0) — see the field doc above.
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

/** The "Echo" triggers — fire on the *caster's* other living allies when the caster successfully applies one of these 3 statuses to something. */
const ECHO_TRIGGER_BY_STATUS: Partial<Record<StatusType, AbilityTrigger>> = {
  trojan: 'onAllyAppliedTrojan',
  leak: 'onAllyAppliedLeak',
  crash: 'onAllyAppliedCrash',
};

/** Fires ctx-relative triggers for a target that just received shield/heal — reuses ctx's own team topology, which is correct whenever the target is on the same side as ctx.self (always true for grantShield/heal, the only effects that call this). */
function fireReceivedTriggers(trigger: 'onShieldReceived' | 'onHealReceived', target: Combatant, ctx: TriggerContext): void {
  fireTrigger(trigger, { self: target, allies: ctx.allies, enemies: ctx.enemies, rng: ctx.rng, log: ctx.log });
}

/** Broadcasts `trigger` to every one of `subject`'s living allies except `subject` itself — the shared "quando aliado X" fan-out used by every ally-reaction trigger (Network Breach, Node Offline, Network Firewall, the 3 Echo triggers). */
export function fireAllyBroadcast(
  trigger: AbilityTrigger,
  subject: Combatant,
  own: Combatant[],
  opposing: Combatant[],
  rng: RngLike,
  log: (entry: BattleLogEntry) => void,
): void {
  for (const ally of own.filter((a) => a !== subject && a.hp > 0)) {
    fireTrigger(trigger, { self: ally, allies: own, enemies: opposing, rng, log });
  }
}

/**
 * "ao morrer" / "ao perder 50% da vida" / "quando escudo quebra" / "ao sofrer
 * dano" fire from multiple, structurally different call sites (a basic
 * attack in battle.ts, an ability's directDamage effect right here, DoT
 * ticks, ICE reflects, enrage true damage) — these shared exports (each also
 * broadcasting its "quando aliado..." pair to the affected unit's own living
 * allies) are exported rather than private to one module so every damage
 * path fires them the same way, given whichever allies/enemies pair is
 * correct for the affected unit's own side.
 */
export function fireDeath(unit: Combatant, allies: Combatant[], enemies: Combatant[], rng: RngLike, log: (entry: BattleLogEntry) => void): void {
  fireTrigger('onDeath', { self: unit, allies, enemies, rng, log });
  fireAllyBroadcast('onAllyDeath', unit, allies, enemies, rng, log);
}

/** Fires whenever `unit` just lost HP, from any source. Call whenever hpDamage > 0. */
export function fireOnWounded(unit: Combatant, allies: Combatant[], enemies: Combatant[], rng: RngLike, log: (entry: BattleLogEntry) => void): void {
  fireTrigger('onWounded', { self: unit, allies, enemies, rng, log });
  fireAllyBroadcast('onAllyWounded', unit, allies, enemies, rng, log);
}

/** Fires on `killer` when something it did ejected an opposing unit. */
export function fireOnKill(killer: Combatant, allies: Combatant[], enemies: Combatant[], rng: RngLike, log: (entry: BattleLogEntry) => void): void {
  fireTrigger('onKill', { self: killer, allies, enemies, rng, log });
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
  fireAllyBroadcast('onAllyShieldBreak', unit, allies, enemies, rng, log);
}

/** "Proxy Defense" — fires on whichever living ally is directly in front of `wounded` in its own queue (`own[index(wounded) - 1]`), if one exists; the front-most unit has no one in front of it. */
export function maybeFireFrontAllyWounded(
  wounded: Combatant,
  own: Combatant[],
  opposing: Combatant[],
  rng: RngLike,
  log: (entry: BattleLogEntry) => void,
): void {
  const idx = own.indexOf(wounded);
  if (idx <= 0) return;
  const front = own[idx - 1];
  if (front.hp <= 0) return;
  fireTrigger('onFrontAllyWounded', { self: front, allies: own, enemies: opposing, rng, log });
}

/** Which allies/enemies list `target` itself belongs to, given the perspective of `ctx` (ctx.self's own team) — needed because an ability effect can target either side (self/allies vs. an enemy), and the death/half-HP/shield-break/wounded triggers need to fire from the *target's* own perspective, not the caster's. */
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
        const echoTrigger = ECHO_TRIGGER_BY_STATUS[effect.status];
        if (echoTrigger) fireAllyBroadcast(echoTrigger, ctx.self, ctx.allies, ctx.enemies, ctx.rng, ctx.log);
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
          fireAllyBroadcast('onAllyShieldReceived', target, ctx.allies, ctx.enemies, ctx.rng, ctx.log);
        }
        break;
      }
      case 'directDamage': {
        const raw = resolveMagnitude(effect.magnitude, ctx, target);
        const mitigated = effect.ignoresDef ? raw : raw * (1 - effectiveDef(target));
        const damage = Math.max(0, Math.round(mitigated));
        const shieldBefore = target.shield;
        const { shieldAbsorbed, hpDamage } = absorbIntoShield(target, damage, effect.ignoresShield);
        target.hp = Math.max(0, target.hp - hpDamage);
        const targetDied = target.hp <= 0;
        ctx.log({ kind: 'directDamage', target: target.name, source: ctx.self.name, amount: damage, shieldAbsorbed, hpDamage, targetDied });
        const { allies: tAllies, enemies: tEnemies } = teamContextFor(target, ctx);
        maybeFireShieldBreak(target, shieldBefore, tAllies, tEnemies, ctx.rng, ctx.log);
        if (hpDamage > 0) fireOnWounded(target, tAllies, tEnemies, ctx.rng, ctx.log);
        if (targetDied) {
          fireDeath(target, tAllies, tEnemies, ctx.rng, ctx.log);
          fireOnKill(ctx.self, ctx.allies, ctx.enemies, ctx.rng, ctx.log);
        } else {
          maybeFireHalfHp(target, tAllies, tEnemies, ctx.rng, ctx.log);
        }
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
    if (ability.kind === 'active') {
      ctx.log({ kind: 'abilityUsed', unit: ctx.self.name, abilityId: ability.id, abilityName: ability.name });
    }
    for (const effect of ability.effects) {
      applyEffect(effect, ctx);
    }
  }
}

export type { AbilityDefinition };
