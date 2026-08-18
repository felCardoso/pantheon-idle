import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

const MAX_TEAM_MEMBERS = 5;

/** Appends characterId to Time1 if it has room — call after a gacha/showcase pull resolves
 * to 'new'. A no-op (not an error) if the character is already on the team or it's full. */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const characterId = body.characterId;
    if (typeof characterId !== 'string') {
      return NextResponse.json({ error: 'characterId is required' }, { status: 400 });
    }

    const { data: existing, error: selectError } = await supabaseAdmin
      .from('player_teams')
      .select('name, characters')
      .eq('user_id', userId)
      .eq('slot', 1)
      .maybeSingle();
    if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });

    const name = existing?.name || 'Time1.cfg';
    const current = (existing?.characters as unknown as string[] | undefined) ?? [];
    if (current.includes(characterId) || current.length >= MAX_TEAM_MEMBERS) {
      return NextResponse.json({ slot: 1, name, characterIds: current, added: false });
    }

    const nextCharacterIds = [...current, characterId];
    const { error: upsertError } = await supabaseAdmin
      .from('player_teams')
      .upsert({ user_id: userId, slot: 1, name, characters: nextCharacterIds, updated_at: new Date().toISOString() }, { onConflict: 'user_id,slot' });
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

    return NextResponse.json({ slot: 1, name, characterIds: nextCharacterIds, added: true });
  });
}
