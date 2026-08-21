import type { AbilityTrigger } from '../schema';
import type { AttackResult, BattleLogEntry, Combatant } from './types';
import type { RngLike } from './rng';

/**
 * Shared contracts between the ability subsystem's modules.
 *
 * These live in their own dependency-free module so `effects.ts` can apply an
 * effect that cascades into more triggers (a directDamage that kills, firing
 * onDeath) WITHOUT importing `abilityEngine.ts`, which imports effects.ts in
 * turn. Instead abilityEngine injects itself as an `EffectRuntime` — the
 * dependency points at this interface, not at a concrete module, so there is
 * no import cycle and effect handlers can be unit-tested with a stub runtime.
 */

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
  /** Turn engine only: whichever unit the acting player/AI explicitly picked for this action — backs the 'chosenTarget' TargetSelector. */
  chosenTarget?: Combatant;
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

/**
 * The trigger-firing capabilities an effect handler may need when its own
 * result cascades (damage that wounds, kills, or breaks a shield). Implemented
 * by abilityEngine.ts and passed down; see the module comment above.
 */
export interface EffectRuntime {
  fireTrigger(trigger: AbilityTrigger, ctx: TriggerContext): void;
  fireDeath(unit: Combatant, allies: Combatant[], enemies: Combatant[], rng: RngLike, log: (e: BattleLogEntry) => void, now: number): void;
  fireOnWounded(unit: Combatant, allies: Combatant[], enemies: Combatant[], rng: RngLike, log: (e: BattleLogEntry) => void, now: number): void;
  fireOnKill(killer: Combatant, allies: Combatant[], enemies: Combatant[], rng: RngLike, log: (e: BattleLogEntry) => void, now: number): void;
  maybeFireHalfHp(unit: Combatant, allies: Combatant[], enemies: Combatant[], rng: RngLike, log: (e: BattleLogEntry) => void, now: number): void;
  maybeFireShieldBreak(
    unit: Combatant,
    shieldBefore: number,
    allies: Combatant[],
    enemies: Combatant[],
    rng: RngLike,
    log: (e: BattleLogEntry) => void,
    now: number,
  ): void;
  fireAllyBroadcast(
    trigger: AbilityTrigger,
    subject: Combatant,
    own: Combatant[],
    opposing: Combatant[],
    rng: RngLike,
    log: (e: BattleLogEntry) => void,
    now: number,
  ): void;
}

/** Which allies/enemies list `target` belongs to, from `ctx`'s perspective. An
 * effect can target either side, and the death/wounded/shield-break triggers
 * must fire from the *target's* own perspective, not the caster's. */
export function teamContextFor(target: Combatant, ctx: TriggerContext): { allies: Combatant[]; enemies: Combatant[] } {
  return ctx.allies.includes(target) ? { allies: ctx.allies, enemies: ctx.enemies } : { allies: ctx.enemies, enemies: ctx.allies };
}
