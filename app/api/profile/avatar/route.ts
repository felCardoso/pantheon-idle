import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

/** The client never validated ownership before — anyone could set any characterId as their
 * avatar. Now checked against player_characters before persisting. */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const characterId = body.characterId;
    if (typeof characterId !== 'string') {
      return NextResponse.json({ error: 'characterId is required' }, { status: 400 });
    }

    const { data: owned, error: ownedError } = await supabaseAdmin
      .from('player_characters')
      .select('character_id')
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .maybeSingle();
    if (ownedError) return NextResponse.json({ error: ownedError.message }, { status: 500 });
    if (!owned) return NextResponse.json({ error: 'Character not owned.' }, { status: 404 });

    const { error: updateError } = await supabaseAdmin.from('profiles').update({ avatar_character_id: characterId }).eq('user_id', userId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ avatarCharacterId: characterId });
  });
}
