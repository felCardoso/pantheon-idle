// AUTO-GENERATED from src/engine — DO NOT EDIT BY HAND.
// Run `npm run sync:pvp-engine` after changing the engine.
// See scripts/sync-pvp-engine.mjs for why this copy exists.
import type { AbilityDefinition, AbilityTrigger } from '../schema.ts';
import type { BattleLogEntry, Combatant } from './types.ts';
import type { RngLike } from './rng.ts';
import type { EffectRuntime, TriggerContext } from './context.ts';
import { applyEffect } from './effects.ts';

/**
 * Trigger dispatch — decides WHICH abilities may fire and WHEN.
 *
 * The three other halves of the ability subsystem live next door and are
 * imported here, never the other way around:
 *   - targeting.ts  — who an effect hits
 *   - magnitude.ts  — how strong it is
 *   - effects.ts    — what it does
 * This module supplies effects.ts with the `EffectRuntime` it needs to cascade
 * (damage that kills fires onDeath, etc.), which is what keeps the dependency
 * one-directional. See context.ts.
 */

export type { TriggerContext } from './context.ts';

/**
 * Which of `unit`'s abilities are eligible right now, by scope
 * (docs/combate.md v3.1 §3):
 *   - passive: always
 *   - active:  only while it is the Vanguard
 *   - bench:   only while it is benched
 */
export function eligibleAbilities(unit: Combatant): AbilityDefinition[] {
  return unit.isVanguard ? [...unit.passiveAbilities, ...unit.activeAbilities] : [...unit.passiveAbilities, ...unit.benchAbilities];
}

/** Broadcasts `trigger` to every one of `subject`'s living allies except itself — the shared "quando aliado X" fan-out. */
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
 * dano" fire from structurally different call sites (a basic attack in
 * battle.ts, an ability's directDamage in effects.ts, DoT ticks, ICE reflects,
 * System Overload) — these shared exports, each also broadcasting its
 * "quando aliado..." pair, exist so every damage path fires them identically.
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

/** This module's own capabilities, handed to effect handlers so they can cascade without importing back into here. */
const RUNTIME: EffectRuntime = {
  fireTrigger,
  fireDeath,
  fireOnWounded,
  fireOnKill,
  maybeFireHalfHp,
  maybeFireShieldBreak,
  fireAllyBroadcast,
};

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
    applyEffect(effect, ctx, RUNTIME);
  }
}

export type { AbilityDefinition };
