import { NextResponse } from 'next/server';
import { getBearerToken } from '../../../../lib/auth-helpers';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { getScopedSupabaseClient } from '../../../../lib/supabase-scoped';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

/** See app/api/market/publish/route.ts's comment — same scoped-RPC pattern. The RPC itself
 * already moves credits between buyer/seller in player_progress; this route additionally
 * reads the buyer's resulting balance back out so the client can reconcile battle.credits
 * (see useBattleSimulation.ts's setWallet) instead of computing the deduction itself. */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const token = getBearerToken(req)!;
    const body = await readJson(req);
    const listingId = body.listingId;
    const quantity = body.quantity;
    if (typeof listingId !== 'string' || typeof quantity !== 'number') {
      return NextResponse.json({ error: 'listingId and quantity are required' }, { status: 400 });
    }

    const scoped = getScopedSupabaseClient(token);
    const { error: rpcError } = await scoped.rpc('purchase_diagram_listing', { p_listing_id: listingId, p_quantity: quantity });
    if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 400 });

    const { data: progress, error: progressError } = await supabaseAdmin.from('player_progress').select('credits').eq('user_id', userId).maybeSingle();
    if (progressError) return NextResponse.json({ error: progressError.message }, { status: 500 });

    return NextResponse.json({ credits: progress?.credits ?? null });
  });
}
