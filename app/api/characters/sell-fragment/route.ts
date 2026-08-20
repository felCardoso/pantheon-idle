import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { FRAGMENT_CONVERSION_BYTES_BY_RARITY } from '../../../../src/data/playerEconomy';
import type { Rarity } from '../../../../src/types';

const VALID_RARITIES = new Set(Object.keys(FRAGMENT_CONVERSION_BYTES_BY_RARITY));

/**
 * Converts diagram fragments into Bytes — Mercado de Diagramas' "Meu Inventário" tab.
 *
 * `count` defaults to 1, but stacks now run to the hundreds (a Zero-Day duplicate alone yields
 * 100), so the tab offers "converter tudo" and this has to be able to take a batch in one call.
 */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const characterId = body.characterId;
    const rarity = body.rarity;
    const count: number = typeof body.count === 'number' ? body.count : 1;
    if (typeof characterId !== 'string' || typeof rarity !== 'string' || !VALID_RARITIES.has(rarity)) {
      return NextResponse.json({ error: 'characterId and a valid rarity are required' }, { status: 400 });
    }
    if (!Number.isInteger(count) || count < 1) {
      return NextResponse.json({ error: 'count must be a positive integer' }, { status: 400 });
    }

    const { data: fragment, error: fragmentError } = await supabaseAdmin
      .from('character_fragments')
      .select('count')
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .eq('rarity', rarity)
      .maybeSingle();
    if (fragmentError) return NextResponse.json({ error: fragmentError.message }, { status: 500 });
    const stackCount: number = fragment?.count ?? 0;
    if (stackCount < count) {
      return NextResponse.json({ error: 'Diagramas insuficientes.' }, { status: 400 });
    }

    const { data: progress, error: progressError } = await supabaseAdmin.from('player_progress').select('bytes').eq('user_id', userId).maybeSingle();
    if (progressError) return NextResponse.json({ error: progressError.message }, { status: 500 });
    if (!progress) return NextResponse.json({ error: 'player_progress row not found — log into the game at least once first' }, { status: 404 });

    const grantedBytes = FRAGMENT_CONVERSION_BYTES_BY_RARITY[rarity as Rarity] * count;
    const nextCount = stackCount - count;
    const nextBytes = progress.bytes + grantedBytes;

    // Compare-and-swap on the stack: two conversions racing must not both read the same count and
    // each be paid for it. Spend first, credit after, so a failure costs diagrams rather than
    // minting Bytes from nothing.
    const { data: spent, error: updateFragmentError } = await supabaseAdmin
      .from('character_fragments')
      .update({ count: nextCount })
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .eq('rarity', rarity)
      .eq('count', stackCount)
      .select('count');
    if (updateFragmentError) return NextResponse.json({ error: updateFragmentError.message }, { status: 500 });
    if (!spent || spent.length === 0) {
      return NextResponse.json({ error: 'Seus diagramas mudaram durante a conversão — tente de novo.' }, { status: 409 });
    }

    const { error: updateBytesError } = await supabaseAdmin.from('player_progress').update({ bytes: nextBytes }).eq('user_id', userId);
    if (updateBytesError) return NextResponse.json({ error: updateBytesError.message }, { status: 500 });

    return NextResponse.json({ grantedBytes, bytes: nextBytes, remainingCount: nextCount });
  });
}
