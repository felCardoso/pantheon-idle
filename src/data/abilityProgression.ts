import { PASSIVE_UNLOCK_RARITY } from '../engine';
import { PASSIVE_UNLOCK_VERSION } from './characterVersion';
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

/**
 * The passive now unlocks on the **version** track, not rarity: a character reaching v2.0 can buy
 * level 1, and a Zero-Day copy has it from the start (docs/combate.md §3 — "desbloqueada
 * automaticamente apenas para personagens Zero-Day. Também pode ser desbloqueada através das
 * melhorias de personagem, quando ele sobe para a v2.0").
 *
 * The two are alternatives, not requirements: either reaching v2.0 or owning Zero-Day opens it.
 */
export function passiveMaxLevel(rarity: Rarity, version: number): number {
  const byVersion = version >= PASSIVE_UNLOCK_VERSION ? 2 : 0;
  return Math.max(PASSIVE_MAX_LEVEL_BY_RARITY[rarity], byVersion);
}

/** Whether level 1 of the passive is free (Zero-Day) or has to be bought (v2.0 at lower rarity). */
export function passiveLevelOneIsFree(rarity: Rarity): boolean {
  return PASSIVE_MAX_LEVEL_BY_RARITY[rarity] > 0;
}

/** Lowest rarity that unlocks the passive ability at all. Defined in engine/schema.ts (loader.ts needs it too); re-exported here for existing UI call sites. */
export { PASSIVE_UNLOCK_RARITY };

/** Créditos cost to reach a given ability level from the one below it. Level 1 is always free (the default). */
export const ABILITY_UPGRADE_COST_CREDITS: Record<number, number> = {
  2: 5000,
  3: 15000,
  4: 45000,
  5: 100000,
};

/**
 * Créditos to reach a given passive level. Level 1 is free for a Zero-Day copy and bought at
 * 50.000 by anything that got there via v2.0 instead; level 2 costs 150.000 either way.
 */
export const PASSIVE_UPGRADE_COST_CREDITS: Record<number, number> = {
  1: 50000,
  2: 150000,
};
