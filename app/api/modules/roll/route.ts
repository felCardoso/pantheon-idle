import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { grantModules, rollModules } from '../../../../lib/module-grants';
import { MODULE_CAPSULE_COST_TOKENS, MODULE_CAPSULE_BUNDLE, MODULE_CAPSULE_BUNDLE_COST_TOKENS } from '../../../../src/data/playerEconomy';

/**
 * The `.rar` capsule — docs/gdd.md section 8's "Cápsulas de invocação — Módulos".
 *
 * Same shape as the character gacha: the price is server-owned, the debit is a compare-and-swap so
 * two concurrent pulls can't spend the same tokens, and the currency is taken before anything is
 * granted so a later failure costs tokens rather than duplicating runes.
 */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const count = body.count ?? 1;
    if (count !== 1 && count !== MODULE_CAPSULE_BUNDLE) {
      return NextResponse.json({ error: `count must be 1 or ${MODULE_CAPSULE_BUNDLE}` }, { status: 400 });
    }
    const price = count === 1 ? MODULE_CAPSULE_COST_TOKENS : MODULE_CAPSULE_BUNDLE_COST_TOKENS;

    const { data: progress, error: progressError } = await supabaseAdmin
      .from('player_progress')
      .select('tokens')
      .eq('user_id', userId)
      .maybeSingle();
    if (progressError) return NextResponse.json({ error: progressError.message }, { status: 500 });
    if (!progress) return NextResponse.json({ error: 'player_progress row not found' }, { status: 404 });
    if (progress.tokens < price) return NextResponse.json({ error: 'Tokens insuficientes.' }, { status: 400 });

    const { data: debited, error: debitError } = await supabaseAdmin
      .from('player_progress')
      .update({ tokens: progress.tokens - price })
      .eq('user_id', userId)
      .eq('tokens', progress.tokens)
      .select('tokens');
    if (debitError) return NextResponse.json({ error: debitError.message }, { status: 500 });
    if (!debited || debited.length === 0) {
      return NextResponse.json({ error: 'Saldo alterado durante a invocação — tente de novo.' }, { status: 409 });
    }

    const rolled = rollModules(count, 'capsule');
    try {
      await grantModules(userId, rolled);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }

    return NextResponse.json({ modules: rolled, tokens: debited[0].tokens });
  });
}
