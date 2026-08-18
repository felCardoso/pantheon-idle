import { PASSIVE_UNLOCK_RARITY } from '../engine/schema';
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
 * The passive ability card is locked entirely below Zero-Day (docs/combate.md
 * v3.1 §3, and see PASSIVE_UNLOCK_RARITY in engine/schema.ts) — 0 here means
 * "locked", not "level 0 unlocked".
 *
 * LTS dropped from 1 to 0 alongside that change. No refund path is needed:
 * level 1 has always been free, and level 2 (the only paid tier) already
 * required Zero-Day, so nothing purchased is being revoked.
 */
export const PASSIVE_MAX_LEVEL_BY_RARITY: Record<Rarity, number> = {
  Alpha: 0,
  Beta: 0,
  Stable: 0,
  LTS: 0,
  'Zero-Day': 2,
};

/** Lowest rarity that unlocks the passive ability at all. Defined in engine/schema.ts (loader.ts needs it too); re-exported here for existing UI call sites. */
export { PASSIVE_UNLOCK_RARITY };

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
