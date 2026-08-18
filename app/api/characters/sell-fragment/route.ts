import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { FRAGMENT_CONVERSION_BYTES_BY_RARITY } from '../../../../src/data/playerEconomy';
import type { Rarity } from '../../../../src/types';

const VALID_RARITIES = new Set(Object.keys(FRAGMENT_CONVERSION_BYTES_BY_RARITY));

/** Converts 1 diagram fragment into Bytes — Mercado de Diagramas' "Meu Inventário" tab. */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const characterId = body.characterId;
    const rarity = body.rarity;
    if (typeof characterId !== 'string' || typeof rarity !== 'string' || !VALID_RARITIES.has(rarity)) {
      return NextResponse.json({ error: 'characterId and a valid rarity are required' }, { status: 400 });
    }

    const { data: fragment, error: fragmentError } = await supabaseAdmin
      .from('character_fragments')
      .select('count')
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .eq('rarity', rarity)
      .maybeSingle();
    if (fragmentError) return NextResponse.json({ error: fragmentError.message }, { status: 500 });
    if (!fragment || fragment.count <= 0) {
      return NextResponse.json({ error: 'No fragment of that character/rarity to sell.' }, { status: 400 });
    }

    const { data: progress, error: progressError } = await supabaseAdmin.from('player_progress').select('bytes').eq('user_id', userId).maybeSingle();
    if (progressError) return NextResponse.json({ error: progressError.message }, { status: 500 });
    if (!progress) return NextResponse.json({ error: 'player_progress row not found — log into the game at least once first' }, { status: 404 });

    const grantedBytes = FRAGMENT_CONVERSION_BYTES_BY_RARITY[rarity as Rarity];
    const nextCount = fragment.count - 1;
    const nextBytes = progress.bytes + grantedBytes;

    const { error: updateFragmentError } = await supabaseAdmin
      .from('character_fragments')
      .update({ count: nextCount })
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .eq('rarity', rarity);
    if (updateFragmentError) return NextResponse.json({ error: updateFragmentError.message }, { status: 500 });

    const { error: updateBytesError } = await supabaseAdmin.from('player_progress').update({ bytes: nextBytes }).eq('user_id', userId);
    if (updateBytesError) return NextResponse.json({ error: updateBytesError.message }, { status: 500 });

    return NextResponse.json({ grantedBytes, bytes: nextBytes, remainingCount: nextCount });
  });
}
