import type { Rarity } from '../types';

/**
 * Character versions — the `.exe` evolution track (docs/gdd.md section 7's "diagrama usado para
 * evoluir a versão do personagem").
 *
 * Version is deliberately **per character, not per rarity**: pulling the same character again at a
 * higher rarity doesn't reset the work already put into evolving it, and a player juggling several
 * copies isn't punished for it. Rarity gates ability *levels*; version gates the passive.
 *
 * Stored as an integer of tenths (10 = v1.0, 15 = v1.5, 20 = v2.0) so the whole track is ordinary
 * integer comparison, with no floating-point equality anywhere near a purchase check.
 */

export const VERSION_MIN = 10;
export const VERSION_MAX = 20;

/** "v1.4" for 14. */
export function formatVersion(version: number): string {
  return `v${Math.floor(version / 10)}.${version % 10}`;
}

/**
 * Fragments a duplicate pull yields, by the rarity that was pulled.
 *
 * A duplicate at a higher rarity is worth far more, so chasing versions rewards pulling well
 * rather than merely pulling often.
 */
export const FRAGMENTS_PER_DUPLICATE_BY_RARITY: Record<Rarity, number> = {
  Alpha: 1,
  Beta: 5,
  Stable: 20,
  LTS: 50,
  'Zero-Day': 100,
};

/**
 * Fragments to go from the version below to this one. The curve is flat through the middle and
 * spikes on the last step, so v2.0 — which is what unlocks the passive — stays a real milestone
 * rather than the tail of a grind.
 */
export const VERSION_UPGRADE_COST_FRAGMENTS: Record<number, number> = {
  11: 5,
  12: 10,
  13: 20,
  14: 35,
  15: 50,
  16: 50,
  17: 50,
  18: 50,
  19: 50,
  20: 100,
};

/** Fragments needed to reach `version` from the one below, or null if it isn't a reachable step. */
export function versionUpgradeCost(version: number): number | null {
  return VERSION_UPGRADE_COST_FRAGMENTS[version] ?? null;
}

/** Total fragments to take a character from v1.0 all the way to v2.0 — 420 as the table stands. */
export function totalFragmentsToMaxVersion(): number {
  return Object.values(VERSION_UPGRADE_COST_FRAGMENTS).reduce((sum, cost) => sum + cost, 0);
}

/** The version at which a character's passive ability becomes purchasable at all. Defined in
 * engine/schema.ts (loader.ts gates the passive on it too); re-exported here for the UI/API. */
export { PASSIVE_UNLOCK_VERSION } from '../engine';
