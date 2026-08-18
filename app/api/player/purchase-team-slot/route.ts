import { NextResponse } from 'next/server';
import { withUser } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { TEAM_SLOT_COST_TOKENS, MAX_TEAM_SLOTS } from '../../../../src/data/playerEconomy';

export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const { data: progress, error: selectError } = await supabaseAdmin
      .from('player_progress')
      .select('tokens, unlocked_team_slots')
      .eq('user_id', userId)
      .maybeSingle();
    if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });
    if (!progress) return NextResponse.json({ error: 'player_progress row not found — log into the game at least once first' }, { status: 404 });

    if (progress.unlocked_team_slots >= MAX_TEAM_SLOTS) {
      return NextResponse.json({ error: 'Todos os slots já desbloqueados.' }, { status: 400 });
    }
    if (progress.tokens < TEAM_SLOT_COST_TOKENS) {
      return NextResponse.json({ error: 'Tokens insuficientes.' }, { status: 400 });
    }

    const nextTokens = progress.tokens - TEAM_SLOT_COST_TOKENS;
    const nextSlots = progress.unlocked_team_slots + 1;
    // Compare-and-swap on both values just read: two concurrent purchases would otherwise each
    // pass the checks above and unlock one slot apiece while only one payment lands.
    const { data: charged, error: updateError } = await supabaseAdmin
      .from('player_progress')
      .update({ tokens: nextTokens, unlocked_team_slots: nextSlots })
      .eq('user_id', userId)
      .eq('tokens', progress.tokens)
      .eq('unlocked_team_slots', progress.unlocked_team_slots)
      .select('user_id');
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    if (!charged || charged.length === 0) {
      return NextResponse.json({ error: 'Saldo alterado durante a compra — tente de novo.' }, { status: 409 });
    }

    return NextResponse.json({ tokens: nextTokens, unlockedTeamSlots: nextSlots });
  });
}
