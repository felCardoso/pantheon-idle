// AUTO-GENERATED from src/engine — DO NOT EDIT BY HAND.
// Run `npm run sync:pvp-engine` after changing the source.
// See scripts/sync-pvp-engine.mjs for why this copy exists.
import type { BattleLogEntry } from '../core/types.ts';
import type { TriggerContext } from '../core/context.ts';
import { checkVictory, decideByRemainingHp } from '../core/battle.ts';
import { resolveAttack } from '../core/damage.ts';
import { Rng, type RngLike } from '../core/rng.ts';
import { absorbIntoShield, dispelStatuses, effectiveIce } from '../core/statusEffects.ts';
import {
  activateAbility,
  fireAbility,
  fireDeath,
  fireOnKill,
  fireOnWounded,
  fireTrigger,
  isAbilityUsable,
  maybeFireHalfHp,
  maybeFireShieldBreak,
} from './abilityEngine.ts';
import { decideEnemyAction, orderEnemyUnits } from './aiPolicy.ts';
import { isLegalSingleTarget, targetableRow } from './formation.ts';
import { advanceOneRound, isStunned } from './statusClock.ts';
import { TURN_CONSTANTS } from '../data/index.ts';
import type { TurnAction, TurnBattleLogEntry, TurnCombatant, TurnPhase } from './types.ts';

/**
 * The turn engine's state machine: a round is an Ally Phase (the attacker activates each of
 * their own living units, one at a time, in whatever order they choose) followed by an Enemy
 * Phase (the AI activates its own living units — see aiPolicy.ts). See src/engine/turn/types.ts
 * for the phase/log model this drives.
 *
 * Like core/battle.ts, this mutates the Combatants (and this state object) in place rather than
 * threading immutable copies through — applyPlayerAction returns the same `state` it was given,
 * for convenient chaining, not a new one.
 */

export interface TurnBattleState {
  allies: TurnCombatant[];
  enemies: TurnCombatant[];
  round: number;
  phase: TurnPhase;
  rng: RngLike;
  log: TurnBattleLogEntry[];
  winner: 'allies' | 'enemies' | 'draw' | null;
}

function pushLog(state: TurnBattleState, entry: TurnBattleLogEntry): void {
  state.log.push(entry);
}

/**
 * A BattleLogEntry-typed sink for the core (real-time-authored) ability pipeline to log into.
 * Safe to cast through: core/effects.ts and core/abilityEngine.ts only ever construct entries
 * whose `kind` is one of the variants TurnBattleLogEntry also declares with an identical shape
 * (abilityUsed, statusApplied, heal, shieldGranted, directDamage, statusExpired) — the real-time-
 * only kinds (vanguardEnter, attackBlockedStun, overload, ...) are only ever emitted by
 * core/battle.ts itself, which the turn engine never calls.
 */
function coreLog(state: TurnBattleState): (entry: BattleLogEntry) => void {
  return (entry) => pushLog(state, entry as unknown as TurnBattleLogEntry);
}

function teamsOf(state: TurnBattleState, unit: TurnCombatant): { own: TurnCombatant[]; opposing: TurnCombatant[] } {
  return state.allies.includes(unit) ? { own: state.allies, opposing: state.enemies } : { own: state.enemies, opposing: state.allies };
}

function ctxFor(state: TurnBattleState, unit: TurnCombatant, extra: Partial<TriggerContext> = {}): TriggerContext {
  const { own, opposing } = teamsOf(state, unit);
  return { self: unit, allies: own, enemies: opposing, rng: state.rng, log: coreLog(state), now: state.round, ...extra };
}

function fireDeathFor(state: TurnBattleState, unit: TurnCombatant): void {
  const { own, opposing } = teamsOf(state, unit);
  fireDeath(unit, own, opposing, state.rng, coreLog(state), state.round);
}
function maybeFireHalfHpFor(state: TurnBattleState, unit: TurnCombatant): void {
  const { own, opposing } = teamsOf(state, unit);
  maybeFireHalfHp(unit, own, opposing, state.rng, coreLog(state), state.round);
}
function maybeFireShieldBreakFor(state: TurnBattleState, unit: TurnCombatant, shieldBefore: number): void {
  const { own, opposing } = teamsOf(state, unit);
  maybeFireShieldBreak(unit, shieldBefore, own, opposing, state.rng, coreLog(state), state.round);
}
function fireOnWoundedFor(state: TurnBattleState, unit: TurnCombatant): void {
  const { own, opposing } = teamsOf(state, unit);
  fireOnWounded(unit, own, opposing, state.rng, coreLog(state), state.round);
}
function fireOnKillFor(state: TurnBattleState, unit: TurnCombatant): void {
  const { own, opposing } = teamsOf(state, unit);
  fireOnKill(unit, own, opposing, state.rng, coreLog(state), state.round);
}

/**
 * Resolves one basic attack. Mirrors core/battle.ts's performAttack, minus the Vanguard-relative
 * triggers that have no meaning once every unit acts on its own turn: preAttack/postAttack,
 * onCounter (the defender "riposting" the Vanguard specifically) and onAllyAttack (the bench
 * reacting to *the* Vanguard's hit — there is no bench in turn mode). onAttack/onCriticalHit/
 * onDodge and the full death/wound/shield-break/ICE cascade all carry over unchanged.
 */
function performBasicAttack(state: TurnBattleState, attacker: TurnCombatant, defender: TurnCombatant): void {
  const shieldBefore = defender.shield;
  const result = resolveAttack(attacker, defender, state.rng);

  if (result.dodged) {
    pushLog(state, { at: state.round, kind: 'dodge', attacker: attacker.name, defender: defender.name });
    fireTrigger('onDodge', ctxFor(state, defender, { attacker }));
    return;
  }

  pushLog(state, { at: state.round, kind: 'attack', result });
  maybeFireShieldBreakFor(state, defender, shieldBefore);
  if (result.hpDamage > 0) fireOnWoundedFor(state, defender);
  if (result.defenderDied) {
    pushLog(state, { at: state.round, kind: 'death', unit: defender.name });
    fireDeathFor(state, defender);
  } else {
    maybeFireHalfHpFor(state, defender);
  }

  const attackCtx = ctxFor(state, attacker, { defender, attackResult: result });
  fireTrigger('onAttack', attackCtx);
  if (result.crit) fireTrigger('onCriticalHit', attackCtx);
  if (result.defenderDied) fireOnKillFor(state, attacker);

  const iceFraction = effectiveIce(defender);
  if (result.finalDamage > 0 && iceFraction > 0) {
    const reflected = result.finalDamage * iceFraction;
    const attackerShieldBefore = attacker.shield;
    const { shieldAbsorbed: iceShieldAbsorbed, hpDamage: iceHpDamage } = absorbIntoShield(attacker, reflected);
    attacker.hp = Math.max(0, attacker.hp - iceHpDamage);
    maybeFireShieldBreakFor(state, attacker, attackerShieldBefore);
    if (iceHpDamage > 0) fireOnWoundedFor(state, attacker);
    const targetDied = attacker.hp <= 0;
    pushLog(state, {
      at: state.round,
      kind: 'iceReflect',
      source: defender.name,
      target: attacker.name,
      amount: reflected,
      shieldAbsorbed: iceShieldAbsorbed,
      hpDamage: iceHpDamage,
      targetDied,
    });
    if (targetDied) {
      pushLog(state, { at: state.round, kind: 'death', unit: attacker.name });
      fireDeathFor(state, attacker);
    } else {
      maybeFireHalfHpFor(state, attacker);
    }
  }
}

/** Fires a completed channel's stored ability. The stored target is re-resolved by id — it may
 * have died while the channel was in progress, in which case chosenTarget-selector effects
 * simply find no target and fizzle rather than the engine throwing. */
function resolveChannel(state: TurnBattleState, unit: TurnCombatant): void {
  const charge = unit.charging!;
  unit.charging = null;
  const { own, opposing } = teamsOf(state, unit);
  const target = charge.targetId ? [...own, ...opposing].find((c) => c.id === charge.targetId && c.hp > 0) : undefined;
  pushLog(state, { at: state.round, kind: 'channelResolved', unit: unit.name, abilityId: charge.ability.id });
  fireAbility(charge.ability, ctxFor(state, unit, { chosenTarget: target }));
}

/**
 * Runs phase-entry bookkeeping for every living unit on `side`: ability cooldowns tick down,
 * statuses age by one round (statusClock.ts's advanceOneRound), a channel in progress advances
 * or resolves, and a stunned unit's turn is consumed right here rather than being offered up for
 * action — see statusClock.ts's comment on why stun is consumed instead of counted down.
 */
function enterPhase(state: TurnBattleState, side: 'allies' | 'enemies'): void {
  const units = side === 'allies' ? state.allies : state.enemies;
  for (const unit of units) {
    if (unit.hp <= 0) continue;
    unit.hasActedThisRound = false;

    for (const id of Object.keys(unit.abilityCooldownRemaining)) {
      unit.abilityCooldownRemaining[id] = Math.max(0, unit.abilityCooldownRemaining[id] - 1);
    }

    advanceOneRound(unit, state.round, (e) => pushLog(state, e));
    if (unit.hp <= 0) {
      pushLog(state, { at: state.round, kind: 'death', unit: unit.name });
      fireDeathFor(state, unit);
      continue;
    }

    if (isStunned(unit)) {
      dispelStatuses(unit, ['crash']);
      pushLog(state, { at: state.round, kind: 'turnSkippedStun', unit: unit.name });
      unit.hasActedThisRound = true;
      continue;
    }

    if (unit.charging) {
      unit.charging.roundsRemaining -= 1;
      if (unit.charging.roundsRemaining <= 0) {
        resolveChannel(state, unit);
      } else {
        pushLog(state, { at: state.round, kind: 'channelContinue', unit: unit.name, roundsRemaining: unit.charging.roundsRemaining });
      }
      unit.hasActedThisRound = true;
    }
  }
}

/** The next living ally still waiting to act this round, or null if it isn't the Ally Phase or everyone has acted. This is what a client polls to know whose turn it is. */
export function pendingAllyUnit(state: TurnBattleState): TurnCombatant | null {
  if (state.phase !== 'allyTurn') return null;
  return state.allies.find((u) => u.hp > 0 && !u.hasActedThisRound) ?? null;
}

function applyAction(state: TurnBattleState, unit: TurnCombatant, action: TurnAction): void {
  const { own, opposing } = teamsOf(state, unit);
  unit.hasActedThisRound = true;
  pushLog(state, { at: state.round, kind: 'turnStart', unit: unit.name, side: own === state.allies ? 'allies' : 'enemies' });

  if (action.type === 'basicAttack') {
    const legalTargets = targetableRow(opposing);
    const target = action.targetId ? opposing.find((c) => c.id === action.targetId && c.hp > 0) : legalTargets[0];
    if (!target || !isLegalSingleTarget(target, opposing)) throw new Error('Invalid basic attack target');
    performBasicAttack(state, unit, target);
    return;
  }

  const ability = unit.activeAbilities[0];
  if (!ability) throw new Error(`${unit.name} has no active ability to use`);
  if (!isAbilityUsable(unit, ability)) throw new Error(`${unit.name}'s ability is on cooldown`);

  const usesChosenTarget = ability.effects.some((effect) => effect.target === 'chosenTarget');
  let chosenTarget: TurnCombatant | undefined;
  if (usesChosenTarget) {
    if (!action.targetId) throw new Error(`${ability.name} requires a target`);
    chosenTarget = [...own, ...opposing].find((c) => c.id === action.targetId && c.hp > 0);
    if (!chosenTarget) throw new Error('Invalid ability target');
    // Formation only gates who an attack can reach (the enemy's defensive positioning) — it has
    // no bearing on which of your OWN living teammates a support move may target, so the
    // row-legality check only applies when the chosen target is on the opposing side.
    if (opposing.includes(chosenTarget) && !isLegalSingleTarget(chosenTarget, opposing)) {
      throw new Error('Target is not legal for the current formation');
    }
  }

  activateAbility(ability, ctxFor(state, unit, { chosenTarget }), (e) => pushLog(state, e));
}

function endIfDecided(state: TurnBattleState): boolean {
  const winner = checkVictory(state.allies, state.enemies);
  if (!winner) return false;
  state.winner = winner;
  pushLog(state, { at: state.round, kind: 'battleEnd', winner, reason: 'elimination' });
  return true;
}

function runEnemyPhase(state: TurnBattleState): void {
  state.phase = 'enemyTurn';
  enterPhase(state, 'enemies');
  if (endIfDecided(state)) return;

  for (const unit of orderEnemyUnits(state.enemies.filter((u) => u.hp > 0 && !u.hasActedThisRound))) {
    if (unit.hp <= 0 || unit.hasActedThisRound) continue; // may have died or been stunned mid-phase by another unit's action
    applyAction(state, unit, decideEnemyAction(unit, state.enemies, state.allies));
    if (endIfDecided(state)) return;
  }

  advanceRound(state);
}

function advanceRound(state: TurnBattleState): void {
  if (state.round >= TURN_CONSTANTS.roundCap) {
    state.winner = decideByRemainingHp(state.allies, state.enemies);
    pushLog(state, { at: state.round, kind: 'battleEnd', winner: state.winner, reason: 'roundLimit' });
    return;
  }

  state.round += 1;
  state.phase = 'allyTurn';
  pushLog(state, { at: state.round, kind: 'roundStart', round: state.round });
  enterPhase(state, 'allies');
  if (endIfDecided(state)) return;

  // Every living ally may have been stunned/charging this round too — cascade straight into the
  // enemy phase rather than leaving the battle stuck on an ally phase nobody can act in.
  if (!pendingAllyUnit(state)) runEnemyPhase(state);
}

/** Starts a new turn-based battle: boot-sequence passives fire, then round 1's Ally Phase opens. */
export function createTurnBattle(allies: TurnCombatant[], enemies: TurnCombatant[], seed: number): TurnBattleState {
  const state: TurnBattleState = { allies, enemies, round: 1, phase: 'allyTurn', rng: new Rng(seed), log: [], winner: null };

  pushLog(state, { at: 0, kind: 'battleStart' });
  pushLog(state, { at: state.round, kind: 'roundStart', round: state.round });
  for (const unit of [...allies, ...enemies]) fireTrigger('battleStart', ctxFor(state, unit));
  if (endIfDecided(state)) return state;

  enterPhase(state, 'allies');
  if (endIfDecided(state)) return state;
  if (!pendingAllyUnit(state)) runEnemyPhase(state);

  return state;
}

/**
 * Applies one ally's chosen action for this round. Throws on anything illegal (wrong unit, wrong
 * phase, unknown ability, dead/illegal target, ability on cooldown) — the caller (the server in
 * Phase C, or a test/CLI harness here) is expected to validate against pendingAllyUnit()/the
 * unit's own activeAbilities/formation before calling this, same as any other engine boundary.
 *
 * Automatically runs the entire Enemy Phase (AI-only, no further input needed) once the last
 * living ally has acted, and keeps cascading through any following all-stunned/charging rounds,
 * so the caller only ever needs to call this once per *player* decision.
 */
export function applyPlayerAction(state: TurnBattleState, unitId: string, action: TurnAction): TurnBattleState {
  if (state.winner) throw new Error('Battle already finished');
  const unit = state.allies.find((u) => u.id === unitId);
  if (!unit) throw new Error(`Unknown ally: ${unitId}`);
  if (unit !== pendingAllyUnit(state)) throw new Error(`It is not ${unitId}'s turn`);

  applyAction(state, unit, action);
  if (endIfDecided(state)) return state;

  if (!pendingAllyUnit(state)) runEnemyPhase(state);
  return state;
}
