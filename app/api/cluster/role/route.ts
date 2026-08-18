import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

const VALID_ROLES = new Set(['leader', 'officer', 'node']);

/** Leader only, and never against the leader — mirrors ClusterPage.tsx's promote button,
 * which only ever renders for cluster.role === 'leader'. */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const targetUserId = body.targetUserId;
    const role = body.role;
    if (typeof targetUserId !== 'string' || typeof role !== 'string' || !VALID_ROLES.has(role)) {
      return NextResponse.json({ error: "targetUserId and a valid role ('leader'|'officer'|'node') are required" }, { status: 400 });
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('cluster_members')
      .select('cluster_id, role')
      .eq('user_id', userId)
      .maybeSingle();
    if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });
    if (!membership || membership.role !== 'leader') {
      return NextResponse.json({ error: 'Only the leader can change member roles.' }, { status: 403 });
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from('cluster_members')
      .select('role')
      .eq('cluster_id', membership.cluster_id)
      .eq('user_id', targetUserId)
      .maybeSingle();
    if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 });
    if (!target) return NextResponse.json({ error: 'Target is not in this Cluster.' }, { status: 404 });
    if (target.role === 'leader') return NextResponse.json({ error: "Can't change the leader's role this way." }, { status: 400 });

    const { error: updateError } = await supabaseAdmin
      .from('cluster_members')
      .update({ role })
      .eq('cluster_id', membership.cluster_id)
      .eq('user_id', targetUserId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  });
}
