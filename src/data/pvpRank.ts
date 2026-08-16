/**
 * Named PvP rank tiers, computed client-side from `pvp_rating`
 * (`usePvp.ts`) — docs/gdd.md §6's "Ranking/liga por temporadas, com
 * recompensas por faixa" ("faixa" = tier/bracket). No seasons/leagues or
 * per-tier rewards yet (same scope note as the rating system itself,
 * migration 0011) — this is just the tier-name mapping and the leaderboard
 * read-path (supabase/migrations/0018_pvp_ranking.sql).
 *
 * Named after hacker-culture skill tiers rather than generic
 * bronze/silver/gold, to match the game's existing convention of reusing
 * real tech vocabulary for progression (character rarity is
 * Alpha/Beta/Stable/LTS/Zero-Day, VIP is "Root Access"). "Script Kiddie" —
 * the lowest tier — deliberately doubles as Jurupari.iso's weakest trash
 * mob name (src/engine/data/enemies/jurupari.json): the joke is that a
 * bottom-tier PvP player ranks alongside the game's weakest enemy.
 */
export interface PvpRankTier {
  id: string;
  name: string;
  /** Inclusive lower bound — a rating of exactly this value is already in this tier. */
  minRating: number;
}

export const PVP_RANK_TIERS: PvpRankTier[] = [
  { id: 'script-kiddie', name: 'Script Kiddie', minRating: 0 },
  { id: 'operador', name: 'Operador', minRating: 900 },
  { id: 'white-hat', name: 'White Hat', minRating: 1100 },
  { id: 'black-hat', name: 'Black Hat', minRating: 1300 },
  { id: 'elite', name: 'Elite', minRating: 1500 },
  { id: 'singularity', name: 'Singularity', minRating: 1800 },
];

/** The highest tier whose minRating doesn't exceed `rating`. Always returns a tier — PVP_RANK_TIERS[0].minRating is 0. */
export function pvpRankTierFor(rating: number): PvpRankTier {
  let current = PVP_RANK_TIERS[0];
  for (const tier of PVP_RANK_TIERS) {
    if (rating < tier.minRating) break;
    current = tier;
  }
  return current;
}
