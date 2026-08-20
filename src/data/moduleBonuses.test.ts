import { describe, expect, it } from 'vitest';
import { NO_MODULE_BONUSES } from '../engine';
import { bonusesFromModules, equippedByCharacter } from './moduleBonuses';
import { MODULE_DEFINITIONS, resolveModuleEffects } from './modules';

describe('bonusesFromModules', () => {
  it('returns the neutral bag for nothing equipped', () => {
    expect(bonusesFromModules([])).toBe(NO_MODULE_BONUSES);
  });

  it('skips a rune id the catalogue no longer knows rather than throwing', () => {
    // A renamed or retired rune left in someone's inventory must not make their battles
    // unresolvable — it is simply worth nothing until it is cleaned up.
    expect(bonusesFromModules([{ moduleId: 'not-a-real-rune', rarity: 'S' }])).toBe(NO_MODULE_BONUSES);
  });

  it('maps every authored effect kind onto a field the engine reads', () => {
    // Guards the switch in bonusesFromModules: a new ModuleEffectKind added to the catalogue
    // without a case here would silently do nothing in combat.
    for (const definition of MODULE_DEFINITIONS) {
      const bonuses = bonusesFromModules([{ moduleId: definition.id, rarity: 'S' }]);
      const changed = Object.entries(bonuses).some(([key, value]) => value !== NO_MODULE_BONUSES[key as keyof typeof NO_MODULE_BONUSES]);
      expect(changed, `${definition.id} resolved to no engine-visible bonus`).toBe(true);
    }
  });

  it('sums two runes that touch the same stat', () => {
    const crit = MODULE_DEFINITIONS.find((d) => resolveModuleEffects(d, 'S').some((e) => e.kind === 'critChance'))!;
    const one = bonusesFromModules([{ moduleId: crit.id, rarity: 'S' }]);
    const two = bonusesFromModules([
      { moduleId: crit.id, rarity: 'S' },
      { moduleId: crit.id, rarity: 'S' },
    ]);
    expect(two.critChance).toBeCloseTo(one.critChance * 2);
  });

  it('never lets a lower grade beat an S of the same rune, on any rune', () => {
    for (const definition of MODULE_DEFINITIONS) {
      const s = bonusesFromModules([{ moduleId: definition.id, rarity: 'S' }]);
      for (const rarity of ['A', 'B', 'C'] as const) {
        const lower = bonusesFromModules([{ moduleId: definition.id, rarity }]);
        for (const key of Object.keys(s) as (keyof typeof s)[]) {
          const top = s[key];
          const below = lower[key];
          if (typeof top !== 'number' || typeof below !== 'number') continue;
          // cleanseIntervalSeconds is the one field where smaller is stronger — a shorter gap
          // between cleanses — so it runs the comparison the other way round.
          if (key === 'cleanseIntervalSeconds') {
            expect(below, `${definition.id} ${rarity}.${key}`).toBeGreaterThanOrEqual(top);
            continue;
          }
          expect(Math.abs(below), `${definition.id} ${rarity}.${key}`).toBeLessThanOrEqual(Math.abs(top));
        }
      }
    }
  });
});

describe('equippedByCharacter', () => {
  it('groups by wearer and drops unequipped rows', () => {
    const grouped = equippedByCharacter([
      { module_id: 'a', rarity: 'S', equipped_on: 'zeus' },
      { module_id: 'b', rarity: 'A', equipped_on: 'zeus' },
      { module_id: 'c', rarity: 'B', equipped_on: 'odin' },
      { module_id: 'd', rarity: 'C', equipped_on: null },
    ]);
    expect(grouped.zeus.map((m) => m.moduleId)).toEqual(['a', 'b']);
    expect(grouped.odin.map((m) => m.moduleId)).toEqual(['c']);
    expect(Object.keys(grouped)).toHaveLength(2);
  });
});
