import { describe, expect, it } from 'vitest';
import type { TriggerContext } from './context';
import { resolveTargets } from './targeting';
import { makeCombatant, ScriptedRng } from './testUtils';

function baseCtx(overrides: Partial<TriggerContext>): TriggerContext {
  return { self: makeCombatant(), allies: [], enemies: [], rng: new ScriptedRng([]), log: () => {}, now: 0, ...overrides };
}

describe('resolveTargets — plain PvE Combatants (no row field) are unaffected by turn-mode row-awareness', () => {
  it('lowestHpEnemy still picks the lowest-HP living enemy regardless of position', () => {
    const front = makeCombatant({ name: 'Front', hp: 50, maxHp: 100 });
    const back = makeCombatant({ name: 'Back', hp: 10, maxHp: 100 });
    const ctx = baseCtx({ enemies: [front, back] });
    expect(resolveTargets('lowestHpEnemy', ctx).map((c) => c.name)).toEqual(['Back']);
  });

  it('randomEnemy can still pick any living enemy, front or back', () => {
    const front = makeCombatant({ name: 'Front' });
    const back = makeCombatant({ name: 'Back' });
    const ctx = baseCtx({ enemies: [front, back], rng: new ScriptedRng([0.9]) }); // picks the last element
    expect(resolveTargets('randomEnemy', ctx).map((c) => c.name)).toEqual(['Back']);
  });
});

describe('resolveTargets — turn-mode row-awareness (units carrying a `row` field)', () => {
  const frontEnemy = () => ({ ...makeCombatant({ name: 'FrontEnemy', hp: 10, maxHp: 100 }), row: 'front' as const });
  const backEnemy = () => ({ ...makeCombatant({ name: 'BackEnemy', hp: 1, maxHp: 100 }), row: 'back' as const });

  it('lowestHpEnemy is restricted to the front row even though the back row is lower HP', () => {
    const front = frontEnemy();
    const back = backEnemy();
    const ctx = baseCtx({ enemies: [front, back] });
    expect(resolveTargets('lowestHpEnemy', ctx).map((c) => c.name)).toEqual(['FrontEnemy']);
  });

  it('falls back to the back row once the front row is fully dead', () => {
    const front = { ...frontEnemy(), hp: 0 };
    const back = backEnemy();
    const ctx = baseCtx({ enemies: [front, back] });
    expect(resolveTargets('lowestHpEnemy', ctx).map((c) => c.name)).toEqual(['BackEnemy']);
  });

  it('allEnemies (area) ignores row entirely, hitting both', () => {
    const front = frontEnemy();
    const back = backEnemy();
    const ctx = baseCtx({ enemies: [front, back] });
    expect(resolveTargets('allEnemies', ctx).map((c) => c.name).sort()).toEqual(['BackEnemy', 'FrontEnemy']);
  });
});
