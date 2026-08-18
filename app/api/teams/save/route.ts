import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

// docs/combate.md section 1: "Times de até 5 personagens por lado." Matches usePlayerTeams.ts's MAX_TEAM_MEMBERS.
const MAX_TEAM_MEMBERS = 5;

function defaultName(slot: number): string {
  return `Time${slot}.cfg`;
}

/** Renames a team and/or replaces its member list (both usePlayerTeams.ts's renameTeam and
 * setTeamCharacters funnel through this one route) — reads the slot's current row and merges
 * whichever of name/characterIds the caller provided, so the client never has to know the
 * field it isn't changing. */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const slot = body.slot;
    const name = body.name;
    const characterIds = body.characterIds;
    if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 1 || slot > 5) {
      return NextResponse.json({ error: 'slot must be an integer between 1 and 5' }, { status: 400 });
    }
    if (name !== undefined && typeof name !== 'string') {
      return NextResponse.json({ error: 'name must be a string' }, { status: 400 });
    }
    if (characterIds !== undefined && (!Array.isArray(characterIds) || !characterIds.every((id) => typeof id === 'string'))) {
      return NextResponse.json({ error: 'characterIds must be an array of strings' }, { status: 400 });
    }

    const { data: existing, error: selectError } = await supabaseAdmin
      .from('player_teams')
      .select('name, characters')
      .eq('user_id', userId)
      .eq('slot', slot)
      .maybeSingle();
    if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });

    const nextName = (name?.trim() || existing?.name || defaultName(slot)).slice(0, 60);
    const nextCharacterIds = ((characterIds as string[] | undefined) ?? (existing?.characters as unknown as string[] | undefined) ?? []).slice(
      0,
      MAX_TEAM_MEMBERS,
    );

    const { error: upsertError } = await supabaseAdmin
      .from('player_teams')
      .upsert({ user_id: userId, slot, name: nextName, characters: nextCharacterIds, updated_at: new Date().toISOString() }, { onConflict: 'user_id,slot' });
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

    return NextResponse.json({ slot, name: nextName, characterIds: nextCharacterIds });
  });
}
