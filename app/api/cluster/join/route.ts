import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const clusterId = body.clusterId;
    if (typeof clusterId !== 'string') {
      return NextResponse.json({ error: 'clusterId is required' }, { status: 400 });
    }

    const { error: insertError } = await supabaseAdmin.from('cluster_members').insert({ cluster_id: clusterId, user_id: userId, role: 'node' });
    if (insertError) {
      // migration 0010's unique index on cluster_members.user_id — already in a Cluster.
      return NextResponse.json({ error: 'você já está em um Cluster — saia do atual antes de entrar em outro.' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  });
}
