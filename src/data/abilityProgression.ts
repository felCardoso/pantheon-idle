import type { Rarity } from '../types';

/**
 * How far a character's ability level (1-5, shared across their active kit)
 * can go, gated by the best rarity the player currently owns of that
 * character — independent of the passive-specific track below.
 */
export const ABILITY_MAX_LEVEL_BY_RARITY: Record<Rarity, number> = {
  Alpha: 1,
  Beta: 2,
  Stable: 3,
  LTS: 4,
  'Zero-Day': 5,
};

/**
 * The passive ability card itself is locked entirely below LTS (see
 * CharacterDetailModal) — 0 here means "locked", not "level 0 unlocked".
 */
export const PASSIVE_MAX_LEVEL_BY_RARITY: Record<Rarity, number> = {
  Alpha: 0,
  Beta: 0,
  Stable: 0,
  LTS: 1,
  'Zero-Day': 2,
};

/** Lowest rarity that unlocks the passive ability at all. */
export const PASSIVE_UNLOCK_RARITY: Rarity = 'LTS';

/** Créditos cost to reach a given ability level from the one below it. Level 1 is always free (the default). */
export const ABILITY_UPGRADE_COST_CREDITS: Record<number, number> = {
  2: 5000,
  3: 15000,
  4: 30000,
  5: 50000,
};

/** Créditos cost to reach a given passive level. Level 1 is always free once LTS+ unlocks it. */
export const PASSIVE_UPGRADE_COST_CREDITS: Record<number, number> = {
  2: 50000,
};
