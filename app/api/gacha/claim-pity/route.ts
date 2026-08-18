import { NextResponse } from 'next/server';
import { getUserFromRequest, UnauthorizedError } from '../../../../lib/auth-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { applyAcquire, loadOwnershipState } from '../../../../lib/gacha';
import { currentShowcaseWeek, pickWeeklyBannerCharacter } from '../../../../src/data/roster';
import type { Rarity } from '../../../../src/types';

// Mirrors usePlayerProgress.ts's BANNER_PITY_MAX — the hard-pity threshold for the "Extrair
// Executável Garantido" claim (docs/gdd.md section 10).
const BANNER_PITY_MAX = 150;
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

  const { data: progress, error: progressError } = await supabaseAdmin
    .from('player_progress')
    .select('banner_pity')
    .eq('user_id', userId)
    .maybeSingle();
  if (progressError) return NextResponse.json({ error: progressError.message }, { status: 500 });
  if (!progress) return NextResponse.json({ error: 'player_progress row not found — log into the game at least once first' }, { status: 404 });

  if (progress.banner_pity < BANNER_PITY_MAX) {
    return NextResponse.json({ error: 'Garantia ainda não atingida.' }, { status: 400 });
  }

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

  const { error: updateError } = await supabaseAdmin.from('player_progress').update({ banner_pity: 0, banner_guaranteed: false }).eq('user_id', userId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ result: results[0], bannerPity: 0, bannerGuaranteed: false });
}
