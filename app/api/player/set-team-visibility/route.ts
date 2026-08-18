import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

const VALID_VALUES = new Set(['pve', 'pvp', 'hidden']);

export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const value = body.value;
    if (typeof value !== 'string' || !VALID_VALUES.has(value)) {
      return NextResponse.json({ error: "value must be 'pve', 'pvp', or 'hidden'" }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin.from('player_progress').update({ team_visibility: value }).eq('user_id', userId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ teamVisibility: value });
  });
}
