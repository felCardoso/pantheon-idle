import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

const TOTAL_SLOTS = 5;

/** Onboarding: seeds all 5 team slots with [starterCharacterId] — call once, right after
 * /api/characters/claim-starter. */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const starterCharacterId = body.starterCharacterId;
    if (typeof starterCharacterId !== 'string') {
      return NextResponse.json({ error: 'starterCharacterId is required' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const rows = Array.from({ length: TOTAL_SLOTS }, (_, i) => ({
      user_id: userId,
      slot: i + 1,
      name: `Time${i + 1}.cfg`,
      characters: [starterCharacterId],
      updated_at: nowIso,
    }));

    const { error: upsertError } = await supabaseAdmin.from('player_teams').upsert(rows, { onConflict: 'user_id,slot' });
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

    return NextResponse.json({ teams: rows.map((r) => ({ slot: r.slot, name: r.name, characterIds: r.characters })) });
  });
}
