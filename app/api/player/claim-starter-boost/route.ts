import { NextResponse } from 'next/server';
import { withUser } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { STARTER_BOOST_CREDITS } from '../../../../src/data/playerEconomy';

export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const { data: progress, error: selectError } = await supabaseAdmin
      .from('player_progress')
      .select('credits, starter_boost_claimed')
      .eq('user_id', userId)
      .maybeSingle();
    if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });
    if (!progress) return NextResponse.json({ error: 'player_progress row not found — log into the game at least once first' }, { status: 404 });
    if (progress.starter_boost_claimed) {
      return NextResponse.json({ error: 'Bônus de boas-vindas já resgatado.' }, { status: 400 });
    }

    const nextCredits = progress.credits + STARTER_BOOST_CREDITS;
    const { error: updateError } = await supabaseAdmin
      .from('player_progress')
      .update({ credits: nextCredits, starter_boost_claimed: true })
      .eq('user_id', userId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ credits: nextCredits });
  });
}
