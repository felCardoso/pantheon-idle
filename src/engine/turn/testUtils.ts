import { makeCombatant } from '../core/testUtils';
import type { Combatant } from '../core/types';
import type { AbilityDefinition, BaseStats } from '../schema';
import type { TurnCombatant } from './types';

/** Turn-engine sibling of core/testUtils.ts's makeCombatant — same defaults, plus the turn-native fields (row/charging/hasActedThisRound). */
export function makeTurnCombatant(
  overrides: Partial<Combatant> & Partial<Pick<TurnCombatant, 'row' | 'charging' | 'hasActedThisRound'>> & { baseStats?: Partial<BaseStats> } = {},
): TurnCombatant {
  const base = makeCombatant(overrides);
  return {
    ...base,
    row: overrides.row ?? 'front',
    charging: overrides.charging ?? null,
    hasActedThisRound: overrides.hasActedThisRound ?? false,
  };
}

export function makeTurnAbility(overrides: Partial<AbilityDefinition> & Pick<AbilityDefinition, 'trigger' | 'effects'>): AbilityDefinition {
  return {
    id: overrides.id ?? 'test-turn-ability',
    name: overrides.name ?? 'Test Turn Ability',
    scope: overrides.scope ?? 'active',
    chance: overrides.chance,
    trigger: overrides.trigger,
    effects: overrides.effects,
    channelRounds: overrides.channelRounds,
    turnCooldownRounds: overrides.turnCooldownRounds,
  };
}
