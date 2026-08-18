import { NextResponse } from 'next/server';
import { withUser } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { VIP_COST_TOKENS, VIP_DURATION_DAYS, isVipActive } from '../../../../src/data/playerEconomy';

export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const { data: progress, error: selectError } = await supabaseAdmin
      .from('player_progress')
      .select('tokens, vip_expires_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });
    if (!progress) return NextResponse.json({ error: 'player_progress row not found — log into the game at least once first' }, { status: 404 });

    if (progress.tokens < VIP_COST_TOKENS) {
      return NextResponse.json({ error: 'Tokens insuficientes.' }, { status: 400 });
    }

    const nextTokens = progress.tokens - VIP_COST_TOKENS;
    // Stacks onto remaining time if already active, rather than resetting the clock.
    const base = isVipActive(progress.vip_expires_at) ? new Date(progress.vip_expires_at as string) : new Date();
    const nextExpiresAt = new Date(base.getTime() + VIP_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('player_progress')
      .update({ tokens: nextTokens, vip_expires_at: nextExpiresAt })
      .eq('user_id', userId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ tokens: nextTokens, vipExpiresAt: nextExpiresAt });
  });
}
