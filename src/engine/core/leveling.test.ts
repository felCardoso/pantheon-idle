import { describe, expect, it } from 'vitest';
import { levelForXp, levelMultiplier, xpProgress } from './leveling';

describe('xpProgress', () => {
  it('starts at level 0 with 0 xp', () => {
    expect(xpProgress(0)).toEqual({ level: 0, intoLevel: 0, forNextLevel: 100 });
  });

  it('stays at level 0 until the level-0 threshold (100) is crossed', () => {
    expect(xpProgress(99)).toEqual({ level: 0, intoLevel: 99, forNextLevel: 100 });
  });

  it('advances to level 1 exactly at the threshold, carrying no leftover', () => {
    expect(xpProgress(100)).toEqual({ level: 1, intoLevel: 0, forNextLevel: 115 });
  });

  it('each level costs 15% more xp than the last (100, then 115, then 132, ...)', () => {
    // 100 to reach level 1, 115 more to reach level 2 => 215 total
    expect(xpProgress(214)).toEqual({ level: 1, intoLevel: 114, forNextLevel: 115 });
    expect(xpProgress(215)).toEqual({ level: 2, intoLevel: 0, forNextLevel: 132 });
  });

  it('clamps negative xp to 0', () => {
    expect(xpProgress(-50)).toEqual({ level: 0, intoLevel: 0, forNextLevel: 100 });
  });
});

describe('levelForXp', () => {
  it('matches xpProgress().level', () => {
    expect(levelForXp(0)).toBe(0);
    expect(levelForXp(100)).toBe(1);
    expect(levelForXp(215)).toBe(2);
  });
});

describe('levelMultiplier', () => {
  it('is 1x at level 0', () => {
    expect(levelMultiplier(0)).toBe(1);
  });

  it('is +2% per level', () => {
    expect(levelMultiplier(1)).toBeCloseTo(1.02);
    expect(levelMultiplier(10)).toBeCloseTo(1.2);
  });
});
