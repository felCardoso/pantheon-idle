import { NextResponse } from 'next/server';
import { getUserFromRequest, UnauthorizedError } from '../../../../lib/auth-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { applyAcquire, loadOwnershipState } from '../../../../lib/gacha';
import { currentShowcaseWeek, pickWeeklyBannerCharacter } from '../../../../src/data/roster';
import { BANNER_PITY_MAX } from '../../../../src/data/playerEconomy';
import type { Rarity } from '../../../../src/types';

const BANNER_CLAIM_RARITY: Rarity = 'Zero-Day';

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

  // Spend the pity FIRST, with the threshold as a condition on the update itself, so the
  // check and the reset are one atomic statement. Reading the counter and then resetting it
  // in a separate write let two concurrent claims both observe pity >= MAX and both grant a
  // Zero-Day character — a duplication exploit on the paid banner. If zero rows come back,
  // the counter was already below the threshold (or another request just claimed it).
  //
  // banner_guaranteed is deliberately NOT touched here: it is the separate "lost a 50/50, so
  // the next Zero-Day pulled on the banner is the spotlighted character" carry-over, which
  // migration 0016 documents as independent of this counter. Clearing it made claiming hard
  // pity silently destroy a guarantee the player earned by losing a 50/50.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('player_progress')
    .update({ banner_pity: 0 })
    .eq('user_id', userId)
    .gte('banner_pity', BANNER_PITY_MAX)
    .select('user_id, banner_guaranteed');
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: 'Garantia ainda não atingida.' }, { status: 400 });
  }
  const bannerGuaranteed = claimed[0].banner_guaranteed;

  const bannerCharacterId = pickWeeklyBannerCharacter(currentShowcaseWeek());

  let ownedByCharacterId, fragmentCountByKey;
  try {
    ({ ownedByCharacterId, fragmentCountByKey } = await loadOwnershipState(userId));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  let results;
  try {
    results = await applyAcquire(userId, [{ characterId: bannerCharacterId, rarity: BANNER_CLAIM_RARITY }], ownedByCharacterId, fragmentCountByKey);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  return NextResponse.json({ result: results[0], bannerPity: 0, bannerGuaranteed: bannerGuaranteed });
}
