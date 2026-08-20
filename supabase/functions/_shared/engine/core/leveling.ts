// AUTO-GENERATED from src/engine — DO NOT EDIT BY HAND.
// Run `npm run sync:pvp-engine` after changing the source.
// See scripts/sync-pvp-engine.mjs for why this copy exists.
/**
 * XP -> level curve for owned characters. Every character starts at level 0
 * with 0 XP; level is always *derived* from accumulated XP rather than
 * stored independently, so the two can never drift out of sync.
 *
 * First-pass numbers, easy to retune later: each level costs 15% more XP
 * than the last (100, 115, 132, 152, ...) — compounding growth rather than a
 * flat step, so the climb visibly steepens at higher levels instead of
 * flattening out relative to how much XP a win pays.
 */
const BASE_XP_PER_LEVEL = 100;
const XP_GROWTH_RATE = 1.15;

/** XP needed to advance from `level` to `level + 1`. */
function xpForLevel(level: number): number {
  return Math.round(BASE_XP_PER_LEVEL * Math.pow(XP_GROWTH_RATE, level));
}

export interface XpProgress {
  level: number;
  /** XP earned within the current level. */
  intoLevel: number;
  /** XP needed to go from the current level to the next one. */
  forNextLevel: number;
}

/** Derives level + in-level progress from a character's total accumulated XP. */
export function xpProgress(totalXp: number): XpProgress {
  let level = 0;
  let remaining = Math.max(0, totalXp);
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level += 1;
  }
  return { level, intoLevel: remaining, forNextLevel: xpForLevel(level) };
}

export function levelForXp(totalXp: number): number {
  return xpProgress(totalXp).level;
}

/** +2% to every base stat per level — a simple first-pass power curve, easy to retune. */
export function levelMultiplier(level: number): number {
  return 1 + level * 0.02;
}
