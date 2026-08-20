import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { MODULE_BY_ID } from '../../../../src/data/modules';

/**
 * Equips a rune on a character, or unequips it when `characterId` is null.
 *
 * The client sends only which copy and where. Ownership, the slot, and the one-per-slot rule are
 * all decided here: a rune's slot comes from its own definition rather than the request, so a
 * forged body can't drop an Ultimate into the Attack slot and stack two of them.
 */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const moduleRowId = body.moduleRowId;
    const characterId = body.characterId ?? null;

    if (typeof moduleRowId !== 'string' || !moduleRowId) {
      return NextResponse.json({ error: 'moduleRowId is required' }, { status: 400 });
    }
    if (characterId !== null && typeof characterId !== 'string') {
      return NextResponse.json({ error: 'characterId must be a string or null' }, { status: 400 });
    }

    const { data: moduleRow, error: moduleError } = await supabaseAdmin
      .from('player_modules')
      .select('id, module_id, slot')
      .eq('id', moduleRowId)
      .eq('user_id', userId)
      .maybeSingle();
    if (moduleError) return NextResponse.json({ error: moduleError.message }, { status: 500 });
    if (!moduleRow) return NextResponse.json({ error: 'Módulo não encontrado.' }, { status: 404 });

    if (characterId !== null) {
      const { data: owned, error: ownedError } = await supabaseAdmin
        .from('player_characters')
        .select('character_id')
        .eq('user_id', userId)
        .eq('character_id', characterId)
        .maybeSingle();
      if (ownedError) return NextResponse.json({ error: ownedError.message }, { status: 500 });
      if (!owned) return NextResponse.json({ error: 'Personagem não possuído.' }, { status: 400 });

      // The slot is the rune's own, never the caller's claim.
      const slot = MODULE_BY_ID[moduleRow.module_id]?.slot ?? moduleRow.slot;

      // Free the slot first. The unique index would reject the swap otherwise, and "equip"
      // replacing whatever was there is the behaviour the screen implies.
      const { error: clearError } = await supabaseAdmin
        .from('player_modules')
        .update({ equipped_on: null })
        .eq('user_id', userId)
        .eq('equipped_on', characterId)
        .eq('slot', slot);
      if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('player_modules')
      .update({ equipped_on: characterId })
      .eq('id', moduleRowId)
      .eq('user_id', userId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  });
}
