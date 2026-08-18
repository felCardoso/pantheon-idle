import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

/** Leader or officer only, and never against the leader — mirrors ClusterPage.tsx's
 * isOfficer gate, now enforced server-side instead of just hidden in the UI. */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const targetUserId = body.targetUserId;
    if (typeof targetUserId !== 'string') {
      return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 });
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('cluster_members')
      .select('cluster_id, role')
      .eq('user_id', userId)
      .maybeSingle();
    if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });
    if (!membership || (membership.role !== 'leader' && membership.role !== 'officer')) {
      return NextResponse.json({ error: 'Only the leader or an officer can remove members.' }, { status: 403 });
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from('cluster_members')
      .select('role')
      .eq('cluster_id', membership.cluster_id)
      .eq('user_id', targetUserId)
      .maybeSingle();
    if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 });
    if (!target) return NextResponse.json({ error: 'Target is not in this Cluster.' }, { status: 404 });
    if (target.role === 'leader') return NextResponse.json({ error: "Can't remove the leader." }, { status: 400 });

    const { error: deleteError } = await supabaseAdmin
      .from('cluster_members')
      .delete()
      .eq('cluster_id', membership.cluster_id)
      .eq('user_id', targetUserId);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  });
}
