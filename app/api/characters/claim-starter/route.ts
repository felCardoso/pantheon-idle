import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { ALL_CHARACTER_IDS } from '../../../../src/data/roster';
import type { Rarity } from '../../../../src/types';

// Matches useOwnedCharacters.ts's STARTER_RARITY.
const STARTER_RARITY: Rarity = 'Alpha';

/** Onboarding's one-time starter character pick — only allowed while the player owns
 * nothing yet, mirroring GameShell.tsx's own onboarding gate (ownedCharacters.length === 0). */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const characterId = body.characterId;
    if (typeof characterId !== 'string' || !ALL_CHARACTER_IDS.includes(characterId)) {
      return NextResponse.json({ error: 'Unknown characterId' }, { status: 400 });
    }

    const { count, error: countError } = await supabaseAdmin
      .from('player_characters')
      .select('character_id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
    if (count && count > 0) {
      return NextResponse.json({ error: 'Starter character already claimed.' }, { status: 400 });
    }

    const { error: insertError } = await supabaseAdmin
      .from('player_characters')
      .insert({ user_id: userId, character_id: characterId, rarity: STARTER_RARITY });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    return NextResponse.json({ characterId, rarity: STARTER_RARITY });
  });
}
