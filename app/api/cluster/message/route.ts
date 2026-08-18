import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

const MAX_MESSAGE_LENGTH = 500;

export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const text = body.text;
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('cluster_members')
      .select('cluster_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });
    if (!membership) return NextResponse.json({ error: 'Not in a Cluster.' }, { status: 400 });

    const { error: insertError } = await supabaseAdmin
      .from('cluster_messages')
      .insert({ cluster_id: membership.cluster_id, user_id: userId, text: trimmed });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  });
}
