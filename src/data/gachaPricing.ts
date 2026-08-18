import type { GachaTier } from './roster';

// First-pass numbers, easy to retune later — change these to retune the whole gacha economy.
// Shared by GachaPage.tsx (display only) and app/api/gacha/roll/route.ts (authoritative) so
// the two can never drift out of sync with each other.
export const BANNER_PULL_PRICE_TOKENS = 20;
export const COMMON_PULL_PRICE_CREDITS = 1500;
export const IMPROVED_PULL_PRICE_TOKENS = 15;
export const BUNDLE_SIZE = 10;
export const BUNDLE_DISCOUNT_PERCENT = 0.1;

/** The 10x price for any unit price, always `BUNDLE_SIZE` at `BUNDLE_DISCOUNT_PERCENT` off. */
export function bundlePrice(unitPrice: number): number {
  return Math.round(unitPrice * BUNDLE_SIZE * (1 - BUNDLE_DISCOUNT_PERCENT));
}

export function unitPriceFor(tier: GachaTier): { amount: number; currency: 'credits' | 'tokens' } {
  if (tier === 'normal') return { amount: COMMON_PULL_PRICE_CREDITS, currency: 'credits' };
  if (tier === 'hard') return { amount: IMPROVED_PULL_PRICE_TOKENS, currency: 'tokens' };
  return { amount: BANNER_PULL_PRICE_TOKENS, currency: 'tokens' };
}
