import { describe, expect, it } from 'vitest';
import {
  FRAGMENTS_PER_DUPLICATE_BY_RARITY,
  PASSIVE_UNLOCK_VERSION,
  VERSION_MAX,
  VERSION_MIN,
  VERSION_UPGRADE_COST_FRAGMENTS,
  formatVersion,
  totalFragmentsToMaxVersion,
  versionUpgradeCost,
} from './characterVersion';
import { passiveLevelOneIsFree, passiveMaxLevel } from './abilityProgression';

describe('formatVersion', () => {
  it('renders tenths as a version string', () => {
    expect(formatVersion(10)).toBe('v1.0');
    expect(formatVersion(14)).toBe('v1.4');
    expect(formatVersion(20)).toBe('v2.0');
  });
});

describe('versionUpgradeCost', () => {
  it('prices every step between v1.0 and v2.0, and nothing outside that range', () => {
    for (let version = VERSION_MIN + 1; version <= VERSION_MAX; version++) {
      expect(versionUpgradeCost(version)).toBeGreaterThan(0);
    }
    // v1.0 is where a character starts — there is no step *to* it — and v2.0 is the ceiling.
    expect(versionUpgradeCost(VERSION_MIN)).toBeNull();
    expect(versionUpgradeCost(VERSION_MAX + 1)).toBeNull();
  });

  it('never gets cheaper as the track goes up', () => {
    const costs = Object.keys(VERSION_UPGRADE_COST_FRAGMENTS)
      .map(Number)
      .sort((a, b) => a - b)
      .map((version) => VERSION_UPGRADE_COST_FRAGMENTS[version]);
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i]).toBeGreaterThanOrEqual(costs[i - 1]);
    }
  });

  it('costs 420 fragments to take one character from v1.0 to v2.0', () => {
    // Pinned deliberately: this is the whole grind behind unlocking a passive, so a change to
    // any single step should have to be an explicit decision here rather than a silent drift.
    expect(totalFragmentsToMaxVersion()).toBe(420);
  });
});

describe('FRAGMENTS_PER_DUPLICATE_BY_RARITY', () => {
  it('pays strictly more for a rarer duplicate', () => {
    const yields = [
      FRAGMENTS_PER_DUPLICATE_BY_RARITY.Alpha,
      FRAGMENTS_PER_DUPLICATE_BY_RARITY.Beta,
      FRAGMENTS_PER_DUPLICATE_BY_RARITY.Stable,
      FRAGMENTS_PER_DUPLICATE_BY_RARITY.LTS,
      FRAGMENTS_PER_DUPLICATE_BY_RARITY['Zero-Day'],
    ];
    for (let i = 1; i < yields.length; i++) {
      expect(yields[i]).toBeGreaterThan(yields[i - 1]);
    }
  });

  it('makes a maxed version reachable from a plausible number of duplicates', () => {
    // Four Zero-Day duplicates, or 21 Stable ones — a long chase, not an impossible one.
    expect(FRAGMENTS_PER_DUPLICATE_BY_RARITY['Zero-Day'] * 5).toBeGreaterThan(totalFragmentsToMaxVersion());
    expect(FRAGMENTS_PER_DUPLICATE_BY_RARITY.Alpha * 5).toBeLessThan(totalFragmentsToMaxVersion());
  });
});

describe('passiveMaxLevel', () => {
  it('keeps the passive locked below v2.0 for every rarity under Zero-Day', () => {
    for (const rarity of ['Alpha', 'Beta', 'Stable', 'LTS'] as const) {
      expect(passiveMaxLevel(rarity, VERSION_MIN)).toBe(0);
      expect(passiveMaxLevel(rarity, PASSIVE_UNLOCK_VERSION - 1)).toBe(0);
    }
  });

  it('opens the passive on either path — Zero-Day, or v2.0 at any rarity', () => {
    expect(passiveMaxLevel('Zero-Day', VERSION_MIN)).toBe(2);
    expect(passiveMaxLevel('Alpha', PASSIVE_UNLOCK_VERSION)).toBe(2);
  });

  it('gives level 1 free only to a Zero-Day copy', () => {
    expect(passiveLevelOneIsFree('Zero-Day')).toBe(true);
    for (const rarity of ['Alpha', 'Beta', 'Stable', 'LTS'] as const) {
      expect(passiveLevelOneIsFree(rarity)).toBe(false);
    }
  });
});
