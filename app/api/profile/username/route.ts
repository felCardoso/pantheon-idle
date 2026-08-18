import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const username = body.username;
    if (typeof username !== 'string') {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }
    const trimmed = username.trim();
    if (!USERNAME_PATTERN.test(trimmed)) {
      return NextResponse.json({ error: '3–20 caracteres: letras, números e underscore.' }, { status: 400 });
    }

    const { data: existing, error: checkError } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .ilike('username', trimmed)
      .neq('user_id', userId)
      .maybeSingle();
    if (checkError) return NextResponse.json({ error: checkError.message }, { status: 500 });
    if (existing) return NextResponse.json({ error: 'Esse nome de usuário já está em uso.' }, { status: 400 });

    const { error: updateError } = await supabaseAdmin.from('profiles').update({ username: trimmed }).eq('user_id', userId);
    // The unique index is the real race-condition backstop — a concurrent signup/rename
    // between the check above and this update surfaces here as a constraint violation.
    if (updateError) return NextResponse.json({ error: 'Esse nome de usuário já está em uso.' }, { status: 400 });

    return NextResponse.json({ username: trimmed });
  });
}
