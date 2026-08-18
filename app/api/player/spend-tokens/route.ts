import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

/** Generic token spend with no further side effect of its own — e.g. ProfileModal's
 * nickname-change fee. Actions with their own atomic effect (VIP, team slots, gacha) have
 * their own dedicated routes instead of composing this one. */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const amount = body.amount;
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive integer' }, { status: 400 });
    }

    const { data: progress, error: selectError } = await supabaseAdmin.from('player_progress').select('tokens').eq('user_id', userId).maybeSingle();
    if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });
    if (!progress) return NextResponse.json({ error: 'player_progress row not found — log into the game at least once first' }, { status: 404 });
    if (progress.tokens < amount) {
      return NextResponse.json({ error: 'Tokens insuficientes.' }, { status: 400 });
    }

    // Compare-and-swap on the balance just read: two concurrent spends would otherwise both
    // pass the check above and both write a total computed from the same starting balance,
    // so one of the two amounts would simply vanish.
    const nextTokens = progress.tokens - amount;
    const { data: charged, error: updateError } = await supabaseAdmin
      .from('player_progress')
      .update({ tokens: nextTokens })
      .eq('user_id', userId)
      .eq('tokens', progress.tokens)
      .select('user_id');
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    if (!charged || charged.length === 0) {
      return NextResponse.json({ error: 'Saldo alterado durante a operação — tente de novo.' }, { status: 409 });
    }

    return NextResponse.json({ tokens: nextTokens });
  });
}
