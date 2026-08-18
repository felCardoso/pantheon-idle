import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

/**
 * Saves the squad a PvP attacker will actually fight (supabase/functions/pvp-attack reads
 * this row). The client used to submit each character's full xp/rarity itself — trusted
 * verbatim, so a forged snapshot could hand a defense team fabricated stats. Now the client
 * only names *which* owned characters and ability choices to use; xp/rarity are always
 * re-read from player_characters here, never taken from the request body.
 *
 * That hardening only holds because migration 0020 revoked the client's direct
 * insert/update on pvp_defense_teams — otherwise the browser could simply skip this
 * route and upsert the row itself. This route writes with the service-role key, which
 * bypasses RLS, so it is the only remaining writer.
 */
const MAX_DEFENSE_TEAM_MEMBERS = 5;

export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const rawCharacterIds = body.characterIds;
    const selectedAbilityByCharacterId = (body.selectedAbilityByCharacterId ?? {}) as Record<string, unknown>;
    if (!Array.isArray(rawCharacterIds) || !rawCharacterIds.every((id) => typeof id === 'string')) {
      return NextResponse.json({ error: 'characterIds must be an array of strings' }, { status: 400 });
    }
    if (rawCharacterIds.length > MAX_DEFENSE_TEAM_MEMBERS) {
      return NextResponse.json({ error: `A defense team holds at most ${MAX_DEFENSE_TEAM_MEMBERS} characters.` }, { status: 400 });
    }
    // The same id twice would snapshot the character twice and field it as two
    // separate units — the ownership check below passes either way, since it only
    // asks whether the id is owned, not how many times it appears.
    const characterIds = [...new Set(rawCharacterIds)];

    const { data: owned, error: ownedError } = await supabaseAdmin
      .from('player_characters')
      .select('character_id, xp, rarity')
      .eq('user_id', userId)
      .in('character_id', characterIds);
    if (ownedError) return NextResponse.json({ error: ownedError.message }, { status: 500 });

    const ownedById = new Map((owned ?? []).map((c) => [c.character_id, c]));
    if (characterIds.some((id) => !ownedById.has(id))) {
      return NextResponse.json({ error: 'One or more characters are not owned.' }, { status: 400 });
    }

    const snapshot = characterIds.map((id) => {
      const c = ownedById.get(id)!;
      const selectedAbilityId = selectedAbilityByCharacterId[id];
      return {
        characterId: c.character_id,
        xp: c.xp,
        rarity: c.rarity,
        ...(typeof selectedAbilityId === 'string' ? { selectedAbilityId } : {}),
      };
    });

    const { error: upsertError } = await supabaseAdmin
      .from('pvp_defense_teams')
      .upsert({ user_id: userId, characters: snapshot, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  });
}
