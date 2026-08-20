import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { RARITY_RANK } from '../../../../src/engine';
import { VERSION_MAX, VERSION_MIN, versionUpgradeCost } from '../../../../src/data/characterVersion';
import type { Rarity } from '../../../../src/types';

/**
 * Spends fragments to take a character one version step (v1.3 -> v1.4, and so on).
 *
 * Fragments are stored per (character, rarity) but version is a per-character axis, so the cost is
 * paid from the pooled total — cheapest rarity first, since a Zero-Day fragment is worth 100x an
 * Alpha one at the source and shouldn't be burned on an early step while Alphas sit unused.
 */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const characterId = body.characterId;
    if (typeof characterId !== 'string' || !characterId) {
      return NextResponse.json({ error: 'characterId is required' }, { status: 400 });
    }

    const [{ data: owned }, { data: progressRow }, { data: fragmentRows }] = await Promise.all([
      supabaseAdmin.from('player_characters').select('character_id').eq('user_id', userId).eq('character_id', characterId).maybeSingle(),
      supabaseAdmin.from('character_ability_progress').select('character_version').eq('user_id', userId).eq('character_id', characterId).maybeSingle(),
      supabaseAdmin.from('character_fragments').select('rarity, count').eq('user_id', userId).eq('character_id', characterId),
    ]);

    if (!owned) return NextResponse.json({ error: 'Personagem não possuído.' }, { status: 400 });

    const current = progressRow?.character_version ?? VERSION_MIN;
    if (current >= VERSION_MAX) {
      return NextResponse.json({ error: 'Já está na versão máxima.' }, { status: 400 });
    }
    const nextVersion = current + 1;
    const cost = versionUpgradeCost(nextVersion);
    if (cost === null) return NextResponse.json({ error: 'Versão inválida.' }, { status: 400 });

    const stacks = (fragmentRows ?? [])
      .map((r) => ({ rarity: r.rarity as Rarity, count: r.count }))
      .filter((r) => r.count > 0)
      .sort((a, b) => RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity]);
    const available = stacks.reduce((sum, s) => sum + s.count, 0);
    if (available < cost) {
      return NextResponse.json({ error: `Fragmentos insuficientes (${available}/${cost}).` }, { status: 400 });
    }

    // Spend cheapest-first, then write the version. Order matters: a failure after the version
    // bump would hand out a free upgrade, whereas a failure after spending only costs fragments.
    let remaining = cost;
    for (const stack of stacks) {
      if (remaining <= 0) break;
      const spend = Math.min(stack.count, remaining);
      const { error: spendError } = await supabaseAdmin
        .from('character_fragments')
        .update({ count: stack.count - spend })
        .eq('user_id', userId)
        .eq('character_id', characterId)
        .eq('rarity', stack.rarity)
        .eq('count', stack.count);
      if (spendError) return NextResponse.json({ error: spendError.message }, { status: 500 });
      remaining -= spend;
    }
    if (remaining > 0) {
      return NextResponse.json({ error: 'Fragmentos mudaram durante a operação — tente de novo.' }, { status: 409 });
    }

    const { error: upsertError } = await supabaseAdmin
      .from('character_ability_progress')
      .upsert({ user_id: userId, character_id: characterId, character_version: nextVersion }, { onConflict: 'user_id,character_id' });
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

    return NextResponse.json({ characterId, version: nextVersion, fragmentsSpent: cost });
  });
}
