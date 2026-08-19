/**
 * player_progress economy constants — shared between the client
 * (src/hooks/usePlayerProgress.ts, for display) and the authoritative app/api/player/**
 * and app/api/gacha/** routes (for real spend/grant logic), kept in one place so the two
 * can't drift. Same reasoning as src/data/gachaPricing.ts.
 */

/**
 * Root Access (VIP) — docs/monetizacao-guilda.md section 1. No real payment
 * processor is wired up yet, so the only purchase path today is spending
 * Tokens here — a placeholder for the "cobrada em dinheiro real" recurring
 * billing the docs describe. `VIP_CREDIT_XP_BONUS_PERCENT` is applied to
 * battle rewards in useBattleSimulation.ts.
 */
export const VIP_COST_TOKENS = 500;
export const VIP_DURATION_DAYS = 30;
export const VIP_CREDIT_XP_BONUS_PERCENT = 0.15;
export const VIP_DAILY_BONUS_TOKENS = 50;

/** The Cluster's own passive bonus (docs section 2) — separate constant since it stacks with, not replaces, Root Access's. */
export const CLUSTER_CREDIT_XP_BONUS_PERCENT = 0.25;

/**
 * Team-slot loadouts ("`.cfg`", docs/gdd.md line 92): 2 slots free, +3
 * purchasable for TEAM_SLOT_COST_TOKENS each, or all 5 while Root Access is
 * active (see effectiveUnlockedTeamSlots in usePlayerTeams.ts's caller —
 * VIP access must lapse the instant VIP does, so it's never persisted here).
 */
export const TEAM_SLOT_COST_TOKENS = 250;
export const MIN_TEAM_SLOTS = 2;
export const MAX_TEAM_SLOTS = 5;

/** Loja's one-time starter credit boost. */
export const STARTER_BOOST_CREDITS = 1000;

export const SHOWCASE_CHARACTER_PRICE_CREDITS = 2000;
/** Slot 0 is open to everyone; slots 1-2 require an active Root Access subscription. */
export const SHOWCASE_FREE_SLOTS = 1;

/** Mercado de Diagramas — rarer diagrams convert into more Bytes when sold for currency instead of traded. */
export const FRAGMENT_CONVERSION_BYTES_BY_RARITY: Record<import('../types').Rarity, number> = {
  Alpha: 5,
  Beta: 10,
  Stable: 25,
  LTS: 50,
  'Zero-Day': 100,
};

/** Banner Semanal hard pity (docs/gdd.md section 10) — guaranteed claim of the spotlighted character every this-many banner pulls. */
export const BANNER_PITY_MAX = 150;

/**
 * Random PvP encounters during the PvE grind: no encounter can fire until this many PvE
 * battles have been fought since the last one, and from then on each battle rolls
 * PVP_ENCOUNTER_CHANCE. Rolled server-side in lib/battle-resolve.ts — the counter is a
 * player_progress column so the client can neither farm encounters nor dodge them.
 */
export const PVP_ENCOUNTER_MIN_BATTLES = 3;
export const PVP_ENCOUNTER_CHANCE = 0.25;

export function isVipActive(vipExpiresAt: string | null): boolean {
  return !!vipExpiresAt && new Date(vipExpiresAt).getTime() > Date.now();
}

export function isSameUtcDay(a: string, b: Date): boolean {
  const d = new Date(a);
  return d.getUTCFullYear() === b.getUTCFullYear() && d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() === b.getUTCDate();
}
