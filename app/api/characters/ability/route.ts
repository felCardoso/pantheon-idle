import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import {
  ABILITY_MAX_LEVEL_BY_RARITY,
  ABILITY_UPGRADE_COST_CREDITS,
  PASSIVE_UPGRADE_COST_CREDITS,
  passiveLevelOneIsFree,
  passiveMaxLevel,
} from '../../../../src/data/abilityProgression';
import { formatVersion, PASSIVE_UNLOCK_VERSION } from '../../../../src/data/characterVersion';
import type { Rarity } from '../../../../src/types';

type UpgradeKind = 'ability' | 'bench' | 'passive';
const KINDS: UpgradeKind[] = ['ability', 'bench', 'passive'];

/** Upgrades a character's active, bench or passive level by exactly one step — the next level and
 * its cost are always server-computed from what the player currently has, never taken from
 * the client, so there's no "level" param to validate/forge. */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    const body = await readJson(req);
    const characterId = body.characterId;
    const kind = body.kind as UpgradeKind;
    if (typeof characterId !== 'string' || !KINDS.includes(kind)) {
      return NextResponse.json({ error: "characterId and kind ('ability'|'bench'|'passive') are required" }, { status: 400 });
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
      .select('ability_level, bench_level, passive_level, character_version, selected_ability_id')
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .maybeSingle();
    if (progressionError) return NextResponse.json({ error: progressionError.message }, { status: 500 });
    const current = progressionRow ?? {
      ability_level: 1,
      bench_level: 1,
      passive_level: 0,
      character_version: 10,
      selected_ability_id: null,
    };

    let nextAbilityLevel = current.ability_level;
    let nextBenchLevel = current.bench_level;
    let nextPassiveLevel = current.passive_level;
    let cost: number;

    if (kind === 'ability' || kind === 'bench') {
      // Both active kits share one ceiling — rarity decides how far a character's kit can go, and
      // the bench card is part of that kit — but they are bought separately (migration 0025).
      const max = ABILITY_MAX_LEVEL_BY_RARITY[rarity];
      const level = kind === 'ability' ? current.ability_level : current.bench_level;
      if (level >= max) return NextResponse.json({ error: 'Nível máximo atingido.' }, { status: 400 });
      const next = level + 1;
      if (kind === 'ability') nextAbilityLevel = next;
      else nextBenchLevel = next;
      cost = ABILITY_UPGRADE_COST_CREDITS[next] ?? 0;
    } else {
      // The passive rides the *version* track: v2.0 opens it at any rarity, and a Zero-Day copy
      // has it open from the start (and gets level 1 for free).
      const max = passiveMaxLevel(rarity, current.character_version);
      if (max === 0) {
        return NextResponse.json(
          { error: `Passiva bloqueada — evolua o personagem até a ${formatVersion(PASSIVE_UNLOCK_VERSION)} ou obtenha uma cópia Zero-Day.` },
          { status: 400 },
        );
      }
      if (current.passive_level >= max) return NextResponse.json({ error: 'Nível máximo atingido.' }, { status: 400 });
      nextPassiveLevel = current.passive_level + 1;
      cost = nextPassiveLevel === 1 && passiveLevelOneIsFree(rarity) ? 0 : (PASSIVE_UPGRADE_COST_CREDITS[nextPassiveLevel] ?? 0);
    }

    const { data: progress, error: walletError } = await supabaseAdmin.from('player_progress').select('credits').eq('user_id', userId).maybeSingle();
    if (walletError) return NextResponse.json({ error: walletError.message }, { status: 500 });
    if (!progress) return NextResponse.json({ error: 'player_progress row not found — log into the game at least once first' }, { status: 404 });
    if (progress.credits < cost) return NextResponse.json({ error: 'Créditos insuficientes.' }, { status: 400 });

    const nextCredits = progress.credits - cost;
    // Compare-and-swap: two upgrades racing on the same wallet must not both read the same balance
    // and each spend it. A lost race is a 409 the client can retry, not a free level.
    const { data: debited, error: creditsError } = await supabaseAdmin
      .from('player_progress')
      .update({ credits: nextCredits })
      .eq('user_id', userId)
      .eq('credits', progress.credits)
      .select('credits');
    if (creditsError) return NextResponse.json({ error: creditsError.message }, { status: 500 });
    if (!debited || debited.length === 0) {
      return NextResponse.json({ error: 'Saldo alterado durante a melhoria — tente de novo.' }, { status: 409 });
    }

    const { error: upsertError } = await supabaseAdmin.from('character_ability_progress').upsert(
      {
        user_id: userId,
        character_id: characterId,
        ability_level: nextAbilityLevel,
        bench_level: nextBenchLevel,
        passive_level: nextPassiveLevel,
        character_version: current.character_version,
        selected_ability_id: current.selected_ability_id,
      },
      { onConflict: 'user_id,character_id' },
    );
    if (upsertError) {
      // Refund rather than charge for a level that was never written.
      await supabaseAdmin.from('player_progress').update({ credits: progress.credits }).eq('user_id', userId).eq('credits', nextCredits);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      abilityLevel: nextAbilityLevel,
      benchLevel: nextBenchLevel,
      passiveLevel: nextPassiveLevel,
      credits: nextCredits,
    });
  });
}
