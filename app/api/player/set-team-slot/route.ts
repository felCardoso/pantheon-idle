import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

/** Which of the player's 5 saved teams (usePlayerTeams.ts) currently feeds PvE battles or
 * PvP defense — not economy-critical (no cost, just a selection), migrated for consistency
 * with the rest of player_progress's writes. */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const type = body.type;
    const slot = body.slot;
    if (type !== 'pve' && type !== 'pvp') {
      return NextResponse.json({ error: "type must be 'pve' or 'pvp'" }, { status: 400 });
    }
    if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 1 || slot > 5) {
      return NextResponse.json({ error: 'slot must be an integer between 1 and 5' }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('player_progress')
      .update(type === 'pve' ? { pve_team_slot: slot } : { pvp_team_slot: slot })
      .eq('user_id', userId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json(type === 'pve' ? { pveTeamSlot: slot } : { pvpTeamSlot: slot });
  });
}
