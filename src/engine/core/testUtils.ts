import type { RngLike } from './rng';
import type { Combatant } from './types';
import type { AbilityDefinition, BaseStats } from '../schema';

/** RNG that replays a fixed queue of next() values — for deterministic test scenarios. */
export class ScriptedRng implements RngLike {
  private queue: number[];

  constructor(values: number[]) {
    this.queue = [...values];
  }

  next(): number {
    if (this.queue.length === 0) throw new Error('ScriptedRng ran out of scripted values');
    return this.queue.shift()!;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}

let idCounter = 0;

export function makeCombatant(overrides: Partial<Combatant> & { baseStats?: Partial<BaseStats> } = {}): Combatant {
  idCounter += 1;
  const base: BaseStats = {
    hp: 1000,
    atk: 100,
    def: 0,
    ini: 50,
    esq: 0,
    ...overrides.baseStats,
  };
  const maxHp = overrides.maxHp ?? base.hp;

  return {
    id: overrides.id ?? `test-unit-${idCounter}`,
    templateId: overrides.templateId ?? 'test-unit',
    name: overrides.name ?? `Test Unit ${idCounter}`,
    faction: overrides.faction ?? null,
    element: overrides.element ?? null,
    isAlly: overrides.isAlly ?? true,
    stars: overrides.stars ?? 0,
    level: overrides.level ?? 0,
    base,
    maxHp,
    hp: overrides.hp ?? maxHp,
    shield: overrides.shield ?? 0,
    statuses: overrides.statuses ?? [],
    abilities: overrides.abilities ?? [],
    statusDurationBonus: overrides.statusDurationBonus ?? 0,
    alwaysActsFirst: overrides.alwaysActsFirst ?? false,
  };
}

export function makeAbility(overrides: Partial<AbilityDefinition> & Pick<AbilityDefinition, 'trigger' | 'effects'>): AbilityDefinition {
  return {
    id: overrides.id ?? 'test-ability',
    name: overrides.name ?? 'Test Ability',
    chance: overrides.chance,
    trigger: overrides.trigger,
    effects: overrides.effects,
  };
}
