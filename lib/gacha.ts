import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { RARITY_RANK } from '../src/engine';
import type { Rarity } from '../src/types';

export type AcquireOutcome = 'new' | 'upgraded' | 'duplicate';

export interface AcquireResult {
  characterId: string;
  rarity: Rarity;
  outcome: AcquireOutcome;
}

/**
 * Server-side equivalent of src/hooks/useOwnedCharacters.ts's acquireCharacter, batched:
 * for each pull, decides new/upgraded/duplicate against what the player already owns
 * (mutating ownedByCharacterId/fragmentCountByKey in place, so two pulls in the same batch
 * landing on the same character resolve correctly one after another) and persists the
 * outcome to player_characters/character_fragments. Shared by /api/gacha/roll and
 * /api/gacha/claim-pity so both write through the exact same rules.
 */
export async function applyAcquire(
  userId: string,
  pulls: { characterId: string; rarity: Rarity }[],
  ownedByCharacterId: Map<string, Rarity>,
  fragmentCountByKey: Map<string, number>,
): Promise<AcquireResult[]> {
  const results: AcquireResult[] = [];
  const newRows: { character_id: string; rarity: Rarity }[] = [];
  const upgradedRows: { character_id: string; rarity: Rarity }[] = [];
  const fragmentDeltas = new Map<string, { character_id: string; rarity: Rarity; count: number }>();

  for (const { characterId, rarity } of pulls) {
    const existingRarity = ownedByCharacterId.get(characterId);
    let outcome: AcquireOutcome;
    if (!existingRarity) {
      outcome = 'new';
      ownedByCharacterId.set(characterId, rarity);
      newRows.push({ character_id: characterId, rarity });
    } else if (RARITY_RANK[rarity] > RARITY_RANK[existingRarity]) {
      outcome = 'upgraded';
      ownedByCharacterId.set(characterId, rarity);
      upgradedRows.push({ character_id: characterId, rarity });
    } else {
      outcome = 'duplicate';
      const key = `${characterId}:${rarity}`;
      const nextCount = (fragmentCountByKey.get(key) ?? 0) + 1;
      fragmentCountByKey.set(key, nextCount);
      fragmentDeltas.set(key, { character_id: characterId, rarity, count: nextCount });
    }
    results.push({ characterId, rarity, outcome });
  }

  // Best-effort sequential writes (supabase-js has no cross-table transaction) — same
  // reliability shape the client's own acquireCharacter loop already had.
  for (const row of newRows) {
    const { error } = await supabaseAdmin.from('player_characters').insert({ user_id: userId, character_id: row.character_id, rarity: row.rarity });
    if (error) throw new Error(error.message);
  }
  for (const row of upgradedRows) {
    const { error } = await supabaseAdmin
      .from('player_characters')
      .update({ rarity: row.rarity, xp: 0 })
      .eq('user_id', userId)
      .eq('character_id', row.character_id);
    if (error) throw new Error(error.message);
  }
  for (const delta of fragmentDeltas.values()) {
    const { error } = await supabaseAdmin
      .from('character_fragments')
      .upsert({ user_id: userId, character_id: delta.character_id, rarity: delta.rarity, count: delta.count }, { onConflict: 'user_id,character_id,rarity' });
    if (error) throw new Error(error.message);
  }

  return results;
}

/** Fetches the two tables applyAcquire needs to make its new/upgraded/duplicate decisions, as maps. */
export async function loadOwnershipState(userId: string) {
  const [{ data: ownedRows, error: ownedError }, { data: fragmentRows, error: fragmentError }] = await Promise.all([
    supabaseAdmin.from('player_characters').select('character_id, rarity').eq('user_id', userId),
    supabaseAdmin.from('character_fragments').select('character_id, rarity, count').eq('user_id', userId),
  ]);
  if (ownedError) throw new Error(ownedError.message);
  if (fragmentError) throw new Error(fragmentError.message);

  return {
    ownedByCharacterId: new Map((ownedRows ?? []).map((r) => [r.character_id, r.rarity as Rarity])),
    fragmentCountByKey: new Map((fragmentRows ?? []).map((r) => [`${r.character_id}:${r.rarity}`, r.count])),
  };
}
