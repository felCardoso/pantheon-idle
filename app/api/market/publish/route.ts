import { NextResponse } from 'next/server';
import { getBearerToken } from '../../../../lib/auth-helpers';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { getScopedSupabaseClient } from '../../../../lib/supabase-scoped';

/**
 * publish_diagram_listing (supabase/migrations 0013/0015) is a security-definer RPC that
 * already enforces its own rules via auth.uid() — this route authenticates the caller like
 * every other app/api/** route, then calls the RPC through a client scoped to that same
 * user's token (lib/supabase-scoped.ts) so auth.uid() inside the function still resolves.
 * The RPC remains the actual authority; this just moves the call from the client's own
 * anon-key session into an authoritative route, consistent with the rest of the migration.
 */
export async function POST(req: Request) {
  return withUser(req, async () => {
    const token = getBearerToken(req)!;
    const body = await readJson(req);
    const characterId = body.characterId;
    const rarity = body.rarity;
    const quantity = body.quantity;
    const priceCredits = body.priceCredits;
    if (
      typeof characterId !== 'string' ||
      typeof rarity !== 'string' ||
      typeof quantity !== 'number' ||
      typeof priceCredits !== 'number'
    ) {
      return NextResponse.json({ error: 'characterId, rarity, quantity, priceCredits are required' }, { status: 400 });
    }

    const scoped = getScopedSupabaseClient(token);
    const { data: listingId, error: rpcError } = await scoped.rpc('publish_diagram_listing', {
      p_character_id: characterId,
      p_quantity: quantity,
      p_price_credits: priceCredits,
      p_rarity: rarity,
    });
    if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 400 });

    return NextResponse.json({ listingId });
  });
}
