import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getUserFromRequest, UnauthorizedError } from '../../../../lib/auth-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { applyAcquire, loadOwnershipState } from '../../../../lib/gacha';
import { Rng } from '../../../../src/engine';
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

  // Debit before granting anything, as a compare-and-swap: the balance just read is a
  // condition on the update, so the row only changes if nothing else has spent from it. The
  // previous read-check-then-write let two concurrent rolls both pass the balance check and
  // both spend the same currency. Zero rows back means another request won the race.
  //
  // Debiting first means a later failure costs the player the price without granting a pull,
  // which is the right way round: the alternative duplicates paid characters.
  const debit = supabaseAdmin.from('player_progress');
  const { data: debited, error: debitError } = await (currency === 'credits'
    ? debit.update({ credits: balance - price }).eq('user_id', userId).eq('credits', balance)
    : debit.update({ tokens: balance - price }).eq('user_id', userId).eq('tokens', balance)
  ).select('credits, tokens');
  if (debitError) return NextResponse.json({ error: debitError.message }, { status: 500 });
  if (!debited || debited.length === 0) {
    return NextResponse.json({ error: 'Saldo alterado durante a invocação — tente de novo.' }, { status: 409 });
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
    // Seeded from the CSPRNG rather than Date.now(): this is a paid pull, so the outcome
    // shouldn't be a pure function of a clock an attacker can reason about, and two players
    // rolling in the same millisecond shouldn't receive identical results.
    const rng = new Rng(randomInt(0, 2 ** 32));
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

  // Currency was already debited above; only the banner counters remain to persist.
  const nextCredits = debited[0].credits;
  const nextTokens = debited[0].tokens;
  const nextBannerPity = tier === 'banner' ? progress.banner_pity + count : progress.banner_pity;

  const { error: updateError } = await supabaseAdmin
    .from('player_progress')
    .update({ banner_pity: nextBannerPity, banner_guaranteed: guaranteed })
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
