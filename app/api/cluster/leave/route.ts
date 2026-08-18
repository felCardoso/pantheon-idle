import { NextResponse } from 'next/server';
import { withUser } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('cluster_members')
      .select('cluster_id, role')
      .eq('user_id', userId)
      .maybeSingle();
    if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });
    if (!membership) return NextResponse.json({ error: 'Not in a Cluster.' }, { status: 400 });

    // Leaving as the sole leader with other members still around would orphan the Cluster —
    // hand leadership to the longest-standing officer (or member) first.
    if (membership.role === 'leader') {
      const { data: others, error: othersError } = await supabaseAdmin
        .from('cluster_members')
        .select('user_id, role')
        .eq('cluster_id', membership.cluster_id)
        .neq('user_id', userId)
        .order('joined_at', { ascending: true });
      if (othersError) return NextResponse.json({ error: othersError.message }, { status: 500 });

      const successor = (others ?? []).find((m) => m.role === 'officer') ?? (others ?? [])[0];
      if (successor) {
        const { error: promoteError } = await supabaseAdmin
          .from('cluster_members')
          .update({ role: 'leader' })
          .eq('cluster_id', membership.cluster_id)
          .eq('user_id', successor.user_id);
        if (promoteError) return NextResponse.json({ error: promoteError.message }, { status: 500 });
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from('cluster_members')
      .delete()
      .eq('cluster_id', membership.cluster_id)
      .eq('user_id', userId);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  });
}
