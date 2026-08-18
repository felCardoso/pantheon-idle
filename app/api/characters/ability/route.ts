import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import {
  ABILITY_MAX_LEVEL_BY_RARITY,
  ABILITY_UPGRADE_COST_CREDITS,
  PASSIVE_MAX_LEVEL_BY_RARITY,
  PASSIVE_UNLOCK_RARITY,
  PASSIVE_UPGRADE_COST_CREDITS,
} from '../../../../src/data/abilityProgression';
import { RARITY_RANK } from '../../../../src/engine';
import type { Rarity } from '../../../../src/types';

/** Upgrades a character's ability or passive level by exactly one step — the next level and
 * its cost are always server-computed from what the player currently has, never taken from
 * the client, so there's no "level" param to validate/forge. */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const characterId = body.characterId;
    const kind = body.kind;
    if (typeof characterId !== 'string' || (kind !== 'ability' && kind !== 'passive')) {
      return NextResponse.json({ error: "characterId and kind ('ability'|'passive') are required" }, { status: 400 });
    }

    const { data: owned, error: ownedError } = await supabaseAdmin
      .from('player_characters')
      .select('rarity')
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .maybeSingle();
    if (ownedError) return NextResponse.json({ error: ownedError.message }, { status: 500 });
    if (!owned) return NextResponse.json({ error: 'Character not owned.' }, { status: 404 });
    const rarity = owned.rarity as Rarity;

    const { data: progressionRow, error: progressionError } = await supabaseAdmin
      .from('character_ability_progress')
      .select('ability_level, passive_level, selected_ability_id')
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .maybeSingle();
    if (progressionError) return NextResponse.json({ error: progressionError.message }, { status: 500 });
    const current = progressionRow ?? { ability_level: 1, passive_level: 0, selected_ability_id: null };

    let nextAbilityLevel = current.ability_level;
    let nextPassiveLevel = current.passive_level;
    let cost: number;

    if (kind === 'ability') {
      const max = ABILITY_MAX_LEVEL_BY_RARITY[rarity];
      if (current.ability_level >= max) return NextResponse.json({ error: 'Nível máximo atingido.' }, { status: 400 });
      nextAbilityLevel = current.ability_level + 1;
      cost = ABILITY_UPGRADE_COST_CREDITS[nextAbilityLevel] ?? 0;
    } else {
      if (RARITY_RANK[rarity] < RARITY_RANK[PASSIVE_UNLOCK_RARITY]) {
        return NextResponse.json({ error: 'Passiva bloqueada abaixo de LTS.' }, { status: 400 });
      }
      const max = PASSIVE_MAX_LEVEL_BY_RARITY[rarity];
      if (current.passive_level >= max) return NextResponse.json({ error: 'Nível máximo atingido.' }, { status: 400 });
      nextPassiveLevel = current.passive_level + 1;
      cost = PASSIVE_UPGRADE_COST_CREDITS[nextPassiveLevel] ?? 0;
    }

    const { data: progress, error: walletError } = await supabaseAdmin.from('player_progress').select('credits').eq('user_id', userId).maybeSingle();
    if (walletError) return NextResponse.json({ error: walletError.message }, { status: 500 });
    if (!progress) return NextResponse.json({ error: 'player_progress row not found — log into the game at least once first' }, { status: 404 });
    if (progress.credits < cost) return NextResponse.json({ error: 'Créditos insuficientes.' }, { status: 400 });

    const nextCredits = progress.credits - cost;
    const { error: upsertError } = await supabaseAdmin.from('character_ability_progress').upsert(
      {
        user_id: userId,
        character_id: characterId,
        ability_level: nextAbilityLevel,
        passive_level: nextPassiveLevel,
        selected_ability_id: current.selected_ability_id,
      },
      { onConflict: 'user_id,character_id' },
    );
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

    const { error: creditsError } = await supabaseAdmin.from('player_progress').update({ credits: nextCredits }).eq('user_id', userId);
    if (creditsError) return NextResponse.json({ error: creditsError.message }, { status: 500 });

    return NextResponse.json({ abilityLevel: nextAbilityLevel, passiveLevel: nextPassiveLevel, credits: nextCredits });
  });
}
