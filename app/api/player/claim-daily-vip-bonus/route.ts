import { NextResponse } from 'next/server';
import { withUser } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { VIP_DAILY_BONUS_TOKENS, isVipActive, isSameUtcDay } from '../../../../src/data/playerEconomy';

export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const { data: progress, error: selectError } = await supabaseAdmin
      .from('player_progress')
      .select('tokens, vip_expires_at, vip_daily_bonus_claimed_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });
    if (!progress) return NextResponse.json({ error: 'player_progress row not found — log into the game at least once first' }, { status: 404 });

    if (!isVipActive(progress.vip_expires_at)) {
      return NextResponse.json({ error: 'Root Access não está ativo.' }, { status: 400 });
    }
    const now = new Date();
    if (progress.vip_daily_bonus_claimed_at && isSameUtcDay(progress.vip_daily_bonus_claimed_at, now)) {
      return NextResponse.json({ error: 'Bônus diário já resgatado hoje.' }, { status: 400 });
    }

    const nextTokens = progress.tokens + VIP_DAILY_BONUS_TOKENS;
    const nowIso = now.toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('player_progress')
      .update({ tokens: nextTokens, vip_daily_bonus_claimed_at: nowIso })
      .eq('user_id', userId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ tokens: nextTokens, vipDailyBonusClaimedAt: nowIso });
  });
}
