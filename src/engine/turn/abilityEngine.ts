import type { AbilityDefinition } from '../schema';
import type { TriggerContext } from '../core/context';
import {
  fireAbility,
  fireAllyBroadcast,
  fireDeath,
  fireOnKill,
  fireOnWounded,
  fireTrigger,
  maybeFireHalfHp,
  maybeFireShieldBreak,
} from '../core/abilityEngine';
import type { TurnBattleLogEntry, TurnCombatant } from './types';

/**
 * Turn-native ability dispatch. Passives are core/abilityEngine.ts's fireTrigger/fireAbility and
 * cascade helpers, re-exported completely unchanged: eligibleAbilities(unit) already includes
 * unit.passiveAbilities regardless of unit.isVanguard (see core/abilityEngine.ts), so passives
 * fire correctly for a TurnCombatant even though isVanguard is always false in this engine — and
 * every passive authored today (core/data/abilities.json) uses an event trigger, never
 * `constant`/cooldownSeconds, so nothing here needs a cooldown-driven firing loop (see
 * src/engine/turn/loader.ts's module comment).
 *
 * Turn-mode row-awareness for ability EFFECTS comes for free too: core/targeting.ts's
 * pickExtreme/randomAlly/randomEnemy resolvers structurally detect a `row` field on the units
 * they're given (TurnCombatant carries one, plain PvE Combatants never do) and restrict to the
 * currently-targetable row — no turn-specific target resolution needed here.
 *
 * The one genuinely new capability is activateAbility: turn-mode's single active ability isn't
 * event-triggered (there's no "the Vanguard's attack cadence fires onAttack" in a mode where every
 * unit acts once per round by direct choice) — it's activated directly, by the acting
 * player/AI, via src/engine/turn/roundLoop.ts.
 */

export { fireAbility, fireAllyBroadcast, fireDeath, fireOnKill, fireOnWounded, fireTrigger, maybeFireHalfHp, maybeFireShieldBreak };

/**
 * Activates `ability` for `ctx.self` (already resolved to the unit's own known active ability by
 * roundLoop.ts — this does not check eligibility/scope, callers own that).
 *
 * If the ability channels (AbilityDefinition.channelRounds), this only starts the channel: the
 * caster spends this turn (and channelRounds - 1 more) charging, and the effects fire later, once
 * the channel completes — see roundLoop.ts's phase-entry bookkeeping, which decrements
 * `charging.roundsRemaining` and calls fireAbility once it reaches 0. A non-channeling ability
 * resolves immediately via fireAbility, identically to how a passive's effects resolve.
 */
export function activateAbility(ability: AbilityDefinition, ctx: TriggerContext, log: (entry: TurnBattleLogEntry) => void): void {
  const unit = ctx.self as TurnCombatant;
  if (ability.channelRounds && ability.channelRounds > 0) {
    unit.charging = { ability, targetId: ctx.chosenTarget?.id ?? null, roundsRemaining: ability.channelRounds };
    log({ at: ctx.now, kind: 'channelStart', unit: unit.name, abilityId: ability.id, roundsRemaining: ability.channelRounds });
  } else {
    fireAbility(ability, ctx);
  }
  if (ability.turnCooldownRounds) {
    unit.abilityCooldownRemaining[ability.id] = ability.turnCooldownRounds;
  }
}

/** Whether `unit` may activate `ability` right now — reuses Combatant's abilityCooldownRemaining map (real-time-keyed in seconds, turn-keyed in rounds here; see roundLoop.ts's phase-entry bookkeeping, which decrements it). */
export function isAbilityUsable(unit: TurnCombatant, ability: AbilityDefinition): boolean {
  return (unit.abilityCooldownRemaining[ability.id] ?? 0) <= 0;
}
