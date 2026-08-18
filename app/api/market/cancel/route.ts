import { NextResponse } from 'next/server';
import { getBearerToken } from '../../../../lib/auth-helpers';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { getScopedSupabaseClient } from '../../../../lib/supabase-scoped';

/** See app/api/market/publish/route.ts's comment — same scoped-RPC pattern. */
export async function POST(req: Request) {
  return withUser(req, async () => {
    const token = getBearerToken(req)!;
    const body = await readJson(req);
    const listingId = body.listingId;
    if (typeof listingId !== 'string') {
      return NextResponse.json({ error: 'listingId is required' }, { status: 400 });
    }

    const scoped = getScopedSupabaseClient(token);
    const { error: rpcError } = await scoped.rpc('cancel_diagram_listing', { p_listing_id: listingId });
    if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  });
}
