import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../lib/route-helpers';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const name = body.name;
    const tag = body.tag;
    if (typeof name !== 'string' || name.trim().length < 3) {
      return NextResponse.json({ error: 'nome precisa ter pelo menos 3 caracteres' }, { status: 400 });
    }
    const trimmed = name.trim();
    const trimmedTag = typeof tag === 'string' && tag.trim() ? tag.trim() : null;

    const { data: created, error: insertError } = await supabaseAdmin
      .from('clusters')
      .insert({ name: trimmed, tag: trimmedTag, created_by: userId })
      .select('id')
      .single();
    if (insertError || !created) {
      const msg = insertError?.message.includes('duplicate') ? 'esse nome já está em uso.' : (insertError?.message ?? 'unknown error');
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { error: memberError } = await supabaseAdmin.from('cluster_members').insert({ cluster_id: created.id, user_id: userId, role: 'leader' });
    if (memberError) {
      return NextResponse.json(
        { error: 'já cluster criado, mas não foi possível entrar automaticamente — tente entrar manualmente.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ clusterId: created.id });
  });
}
