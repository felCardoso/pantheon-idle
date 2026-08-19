import { describe, expect, it } from 'vitest';
import {
  MODULE_BY_ID,
  MODULE_DEFINITIONS,
  MODULE_RARITIES,
  MODULE_RARITY_RANK,
  RARITY_BONUS_COUNT,
  describeModule,
  resolveModuleEffects,
  type ModuleRarity,
} from './modules';
import { FRAGMENTS_PER_DUPLICATE_BY_RARITY, VERSION_MAX, VERSION_MIN, formatVersion, versionUpgradeCost } from './characterVersion';

describe('module rarity scaling', () => {
  it('grants the authored magnitudes at S and strictly less below it', () => {
    for (const definition of MODULE_DEFINITIONS) {
      const s = resolveModuleEffects(definition, 'S');
      expect(s.map((e) => e.kind), definition.id).toEqual(definition.effects.slice(0, RARITY_BONUS_COUNT.S).map((e) => e.kind));

      const scalable = definition.effects[0].kind !== 'periodicCleanse';
      if (!scalable) continue;
      const magnitudes = MODULE_RARITIES.map((r) => resolveModuleEffects(definition, r)[0].magnitude);
      // MODULE_RARITIES is S, A, B, C — strictly descending power.
      for (let i = 1; i < magnitudes.length; i++) {
        expect(magnitudes[i], `${definition.id} ${MODULE_RARITIES[i]}`).toBeLessThan(magnitudes[i - 1]);
      }
    }
  });

  it('grants fewer bonuses at lower grades, never more', () => {
    for (const definition of MODULE_DEFINITIONS) {
      let previous = Infinity;
      for (const rarity of MODULE_RARITIES) {
        const count = resolveModuleEffects(definition, rarity).length;
        expect(count, `${definition.id} ${rarity}`).toBeLessThanOrEqual(previous);
        expect(count).toBeGreaterThan(0);
        previous = count;
      }
    }
  });

  it('cleanses more often at higher grades', () => {
    const restore = MODULE_BY_ID.restore;
    const interval = (r: ModuleRarity) => resolveModuleEffects(restore, r)[0].intervalSeconds!;
    expect(interval('S')).toBe(5);
    expect(interval('A')).toBeGreaterThan(interval('S'));
    expect(interval('C')).toBeGreaterThan(interval('A'));
  });

  it('never leaves an unsubstituted placeholder in a description', () => {
    // A grade too low to grant a rune's second effect must not print "{1}" at the player.
    for (const definition of MODULE_DEFINITIONS) {
      for (const rarity of MODULE_RARITIES) {
        expect(describeModule(definition, rarity), `${definition.id} ${rarity}`).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it('gives every rune a unique id and a slot', () => {
    const ids = MODULE_DEFINITIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const definition of MODULE_DEFINITIONS) {
      expect(definition.effects.length, definition.id).toBeGreaterThan(0);
    }
  });

  it('ranks rarities S > A > B > C', () => {
    expect(MODULE_RARITY_RANK.S).toBeGreaterThan(MODULE_RARITY_RANK.A);
    expect(MODULE_RARITY_RANK.A).toBeGreaterThan(MODULE_RARITY_RANK.B);
    expect(MODULE_RARITY_RANK.B).toBeGreaterThan(MODULE_RARITY_RANK.C);
  });
});

describe('character version track', () => {
  it('costs fragments for every step from v1.0 to v2.0, and nothing outside that range', () => {
    for (let v = VERSION_MIN + 1; v <= VERSION_MAX; v++) {
      expect(versionUpgradeCost(v), formatVersion(v)).toBeGreaterThan(0);
    }
    expect(versionUpgradeCost(VERSION_MIN)).toBeNull();
    expect(versionUpgradeCost(VERSION_MAX + 1)).toBeNull();
  });

  it('makes the final step to v2.0 the most expensive, since it is what unlocks the passive', () => {
    const last = versionUpgradeCost(VERSION_MAX)!;
    for (let v = VERSION_MIN + 1; v < VERSION_MAX; v++) {
      expect(last).toBeGreaterThan(versionUpgradeCost(v)!);
    }
  });

  it('formats tenths as a version string', () => {
    expect(formatVersion(10)).toBe('v1.0');
    expect(formatVersion(14)).toBe('v1.4');
    expect(formatVersion(20)).toBe('v2.0');
  });

  it('pays more fragments for a rarer duplicate', () => {
    const yields = (['Alpha', 'Beta', 'Stable', 'LTS', 'Zero-Day'] as const).map((r) => FRAGMENTS_PER_DUPLICATE_BY_RARITY[r]);
    for (let i = 1; i < yields.length; i++) expect(yields[i]).toBeGreaterThan(yields[i - 1]);
  });
});
