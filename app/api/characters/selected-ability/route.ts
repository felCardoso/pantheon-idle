import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

/** Swapping which active ability is equipped is free (docs/combate.md §5) — no rarity/cost
 * gate here, unlike /api/characters/ability. */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const characterId = body.characterId;
    const abilityId = body.abilityId;
    if (typeof characterId !== 'string' || typeof abilityId !== 'string') {
      return NextResponse.json({ error: 'characterId and abilityId are required' }, { status: 400 });
    }

    const { data: owned, error: ownedError } = await supabaseAdmin
      .from('player_characters')
      .select('character_id')
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .maybeSingle();
    if (ownedError) return NextResponse.json({ error: ownedError.message }, { status: 500 });
    if (!owned) return NextResponse.json({ error: 'Character not owned.' }, { status: 404 });

    const { data: progressionRow, error: progressionError } = await supabaseAdmin
      .from('character_ability_progress')
      .select('ability_level, passive_level')
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .maybeSingle();
    if (progressionError) return NextResponse.json({ error: progressionError.message }, { status: 500 });
    const current = progressionRow ?? { ability_level: 1, passive_level: 0 };

    const { error: upsertError } = await supabaseAdmin.from('character_ability_progress').upsert(
      {
        user_id: userId,
        character_id: characterId,
        ability_level: current.ability_level,
        passive_level: current.passive_level,
        selected_ability_id: abilityId,
      },
      { onConflict: 'user_id,character_id' },
    );
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

    return NextResponse.json({ selectedAbilityId: abilityId });
  });
}
