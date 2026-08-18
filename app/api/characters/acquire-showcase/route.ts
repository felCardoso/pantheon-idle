import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { applyAcquire, loadOwnershipState } from '../../../../lib/gacha';
import { currentShowcaseWeek, pickWeeklyShowcase } from '../../../../src/data/roster';
import { FALLBACK_RARITY } from '../../../../src/data/engineDisplay';
import { SHOWCASE_CHARACTER_PRICE_CREDITS, SHOWCASE_FREE_SLOTS, isVipActive } from '../../../../src/data/playerEconomy';

/** Loja's weekly character showcase — direct purchase, no gacha RNG involved. */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const characterId = body.characterId;
    if (typeof characterId !== 'string') {
      return NextResponse.json({ error: 'characterId is required' }, { status: 400 });
    }

    const showcaseIds = pickWeeklyShowcase(currentShowcaseWeek());
    const slotIndex = showcaseIds.indexOf(characterId);
    if (slotIndex === -1) {
      return NextResponse.json({ error: "That character isn't in this week's showcase." }, { status: 400 });
    }

    const { data: progress, error: progressError } = await supabaseAdmin
      .from('player_progress')
      .select('credits, vip_expires_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (progressError) return NextResponse.json({ error: progressError.message }, { status: 500 });
    if (!progress) return NextResponse.json({ error: 'player_progress row not found — log into the game at least once first' }, { status: 404 });

    if (slotIndex >= SHOWCASE_FREE_SLOTS && !isVipActive(progress.vip_expires_at)) {
      return NextResponse.json({ error: 'Root Access required for this slot.' }, { status: 400 });
    }
    if (progress.credits < SHOWCASE_CHARACTER_PRICE_CREDITS) {
      return NextResponse.json({ error: 'Créditos insuficientes.' }, { status: 400 });
    }

    let ownedByCharacterId, fragmentCountByKey;
    try {
      ({ ownedByCharacterId, fragmentCountByKey } = await loadOwnershipState(userId));
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }

    let results;
    try {
      results = await applyAcquire(userId, [{ characterId, rarity: FALLBACK_RARITY }], ownedByCharacterId, fragmentCountByKey);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }

    const nextCredits = progress.credits - SHOWCASE_CHARACTER_PRICE_CREDITS;
    const { error: updateError } = await supabaseAdmin.from('player_progress').update({ credits: nextCredits }).eq('user_id', userId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ result: results[0], credits: nextCredits });
  });
}
