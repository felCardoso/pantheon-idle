import { NextResponse } from 'next/server';
import { getUserFromRequest, UnauthorizedError } from '../../../../lib/auth-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { applyAcquire, loadOwnershipState } from '../../../../lib/gacha';
import { Rng } from '../../../../src/engine/core/rng';
import { currentShowcaseWeek, pickWeeklyBannerCharacter, pullBannerCharacter, pullGachaCharacterWithRarity } from '../../../../src/data/roster';
import type { Rarity } from '../../../../src/types';
import { BUNDLE_SIZE, bundlePrice, unitPriceFor } from '../../../../src/data/gachaPricing';

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await getUserFromRequest(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const tier = (body as { tier?: unknown }).tier;
  const count = (body as { count?: unknown }).count ?? 1;
  if (tier !== 'normal' && tier !== 'hard' && tier !== 'banner') {
    return NextResponse.json({ error: "tier must be 'normal', 'hard', or 'banner'" }, { status: 400 });
  }
  if (count !== 1 && count !== BUNDLE_SIZE) {
    return NextResponse.json({ error: `count must be 1 or ${BUNDLE_SIZE}` }, { status: 400 });
  }

  const { amount: unitPrice, currency } = unitPriceFor(tier);
  const price = count === 1 ? unitPrice : bundlePrice(unitPrice);

  const { data: progress, error: progressError } = await supabaseAdmin
    .from('player_progress')
    .select('credits, tokens, banner_pity, banner_guaranteed')
    .eq('user_id', userId)
    .maybeSingle();
  if (progressError) return NextResponse.json({ error: progressError.message }, { status: 500 });
  if (!progress) return NextResponse.json({ error: 'player_progress row not found — log into the game at least once first' }, { status: 404 });

  const balance = currency === 'credits' ? progress.credits : progress.tokens;
  if (balance < price) {
    return NextResponse.json({ error: 'Saldo insuficiente.' }, { status: 400 });
  }

  let ownedByCharacterId, fragmentCountByKey;
  try {
    ({ ownedByCharacterId, fragmentCountByKey } = await loadOwnershipState(userId));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const bannerCharacterId = tier === 'banner' ? pickWeeklyBannerCharacter(currentShowcaseWeek()) : null;
  let guaranteed = progress.banner_guaranteed;
  const pulls: { characterId: string; rarity: Rarity }[] = [];

  for (let i = 0; i < count; i++) {
    const rng = new Rng((Date.now() + i) >>> 0);
    const { characterId, rarity, guaranteedNext } =
      tier === 'banner'
        ? pullBannerCharacter(rng, bannerCharacterId!, guaranteed)
        : { ...pullGachaCharacterWithRarity(rng, tier), guaranteedNext: guaranteed };
    guaranteed = guaranteedNext;
    pulls.push({ characterId, rarity });
  }

  let results;
  try {
    results = await applyAcquire(userId, pulls, ownedByCharacterId, fragmentCountByKey);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const nextCredits = currency === 'credits' ? progress.credits - price : progress.credits;
  const nextTokens = currency === 'tokens' ? progress.tokens - price : progress.tokens;
  const nextBannerPity = tier === 'banner' ? progress.banner_pity + count : progress.banner_pity;

  const { error: updateError } = await supabaseAdmin
    .from('player_progress')
    .update({ credits: nextCredits, tokens: nextTokens, banner_pity: nextBannerPity, banner_guaranteed: guaranteed })
    .eq('user_id', userId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({
    results,
    credits: nextCredits,
    tokens: nextTokens,
    bannerPity: nextBannerPity,
    bannerGuaranteed: guaranteed,
  });
}
