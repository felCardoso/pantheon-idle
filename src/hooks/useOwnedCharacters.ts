import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { RARITY_RANK } from '../data/roster';
import type { Rarity } from '../types';

export interface OwnedCharacter {
  characterId: string;
  /** Accumulated XP — level is always derived from this (see engine/core/leveling.ts), never stored independently. */
  xp: number;
  /** The card's current best rarity — upgrading via a higher-rarity duplicate raises this and resets xp to 0 (see acquireCharacter). */
  rarity: Rarity;
}

/** One fragment stack — a character can have several, one per rarity it's been pulled as a duplicate at. */
export interface FragmentStack {
  characterId: string;
  rarity: Rarity;
  count: number;
}

export type AcquireOutcome = 'new' | 'upgraded' | 'duplicate';

export interface UseOwnedCharactersResult {
  /** null while loading. Empty once loaded means the player hasn't picked a starter yet. */
  ownedCharacters: OwnedCharacter[] | null;
  /** Fragment ("diagrama") stacks — one entry per (character, rarity) with count > 0. */
  fragments: FragmentStack[];
  loading: boolean;
  /** Non-null if the last load/claim/xp-grant hit an error (e.g. a migration hasn't been run yet) — play continues, just unsaved. */
  error: string | null;
  claimStarter: (characterId: string) => Promise<void>;
  /** Grants the same XP amount to every currently-owned character — the whole owned roster fights together, so everyone who fought earns it. */
  addXp: (amount: number) => void;
  /**
   * A gacha pull landed on characterId at the given rarity: grants ownership
   * if it's new ('new'), raises the owned card to that rarity and resets its
   * XP-level to 0 if it's a strictly higher rarity than what's owned
   * ('upgraded'), or becomes +1 fragment at the pulled rarity otherwise
   * ('duplicate'). Ability/passive levels (character_ability_progress) are
   * never touched here — they're shared across every rarity copy.
   */
  acquireCharacter: (characterId: string, rarity: Rarity) => Promise<AcquireOutcome>;
  /** Consumes 1 fragment of characterId at the given rarity — the caller is responsible for granting the credit/byte refund. */
  sellFragment: (characterId: string, rarity: Rarity) => Promise<void>;
  /** Re-queries character_fragments — call after a Mercado de Diagramas publish/cancel/purchase, since those mutate this row server-side via RPC. */
  refreshFragments: () => Promise<void>;
}

const STARTER_RARITY: Rarity = 'Alpha';

function fragmentKey(characterId: string, rarity: Rarity): string {
  return `${characterId}:${rarity}`;
}

/** Loads and persists which characters a player owns (and their XP/rarity/fragments) in `player_characters`/`character_fragments`. */
export function useOwnedCharacters(userId: string | undefined): UseOwnedCharactersResult {
  const [ownedCharacters, setOwnedCharacters] = useState<OwnedCharacter[] | null>(null);
  const [fragments, setFragments] = useState<FragmentStack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mirrors of the state above, written synchronously wherever the state is written. React
  // state updates aren't visible to the very next synchronous-ish call in the same tick (no
  // render has happened yet), which matters here because acquireCharacter can be called
  // back-to-back for a batch of gacha pulls (see GachaPage's 10x option) — two pulls landing on
  // the same already-owned character/rarity in one batch would both read the same stale count
  // from state and silently drop an increment. Reading/writing through these refs instead keeps
  // every call correct regardless of render timing.
  const ownedRef = useRef<OwnedCharacter[]>([]);
  const fragmentsRef = useRef<Map<string, FragmentStack>>(new Map());

  function syncFragments(next: Map<string, FragmentStack>) {
    fragmentsRef.current = next;
    setFragments([...next.values()].filter((f) => f.count > 0));
  }

  useEffect(() => {
    if (!userId) {
      ownedRef.current = [];
      syncFragments(new Map());
      setOwnedCharacters(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const [charResult, fragResult] = await Promise.all([
        supabase.from('player_characters').select('character_id, xp, rarity').eq('user_id', userId),
        supabase.from('character_fragments').select('character_id, rarity, count').eq('user_id', userId),
      ]);

      if (cancelled) return;

      if (charResult.error) {
        setError(charResult.error.message);
        ownedRef.current = [];
        setOwnedCharacters([]);
      } else {
        const owned = charResult.data.map((row) => ({ characterId: row.character_id, xp: row.xp, rarity: row.rarity as Rarity }));
        ownedRef.current = owned;
        setOwnedCharacters(owned);
      }

      if (fragResult.error) {
        setError((prev) => prev ?? fragResult.error!.message);
      } else {
        const next = new Map<string, FragmentStack>();
        for (const row of fragResult.data) {
          if (row.count <= 0) continue;
          const rarity = row.rarity as Rarity;
          next.set(fragmentKey(row.character_id, rarity), { characterId: row.character_id, rarity, count: row.count });
        }
        syncFragments(next);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const claimStarter = useCallback(
    async (characterId: string) => {
      if (!userId) return;
      const owned = [{ characterId, xp: 0, rarity: STARTER_RARITY }];
      ownedRef.current = owned;
      setOwnedCharacters(owned);
      const { error: insertError } = await supabase
        .from('player_characters')
        .insert({ user_id: userId, character_id: characterId, rarity: STARTER_RARITY });
      setError(insertError ? insertError.message : null);
    },
    [userId],
  );

  const addXp = useCallback(
    (amount: number) => {
      if (!userId || amount <= 0 || ownedRef.current.length === 0) return;
      const next = ownedRef.current.map((c) => ({ ...c, xp: c.xp + amount }));
      ownedRef.current = next;
      setOwnedCharacters(next);
      supabase
        .from('player_characters')
        .upsert(
          next.map((c) => ({ user_id: userId, character_id: c.characterId, xp: c.xp, rarity: c.rarity })),
          { onConflict: 'user_id,character_id' },
        )
        .then(({ error: upsertError }) => setError(upsertError ? upsertError.message : null));
    },
    [userId],
  );

  const acquireCharacter = useCallback(
    async (characterId: string, rarity: Rarity): Promise<AcquireOutcome> => {
      if (!userId) return 'duplicate';

      const existing = ownedRef.current.find((c) => c.characterId === characterId);

      if (!existing) {
        const next = [...ownedRef.current, { characterId, xp: 0, rarity }];
        ownedRef.current = next;
        setOwnedCharacters(next);
        const { error: insertError } = await supabase
          .from('player_characters')
          .insert({ user_id: userId, character_id: characterId, rarity });
        setError(insertError ? insertError.message : null);
        return 'new';
      }

      if (RARITY_RANK[rarity] > RARITY_RANK[existing.rarity]) {
        const next = ownedRef.current.map((c) => (c.characterId === characterId ? { ...c, rarity, xp: 0 } : c));
        ownedRef.current = next;
        setOwnedCharacters(next);
        const { error: updateError } = await supabase
          .from('player_characters')
          .update({ rarity, xp: 0 })
          .eq('user_id', userId)
          .eq('character_id', characterId);
        setError(updateError ? updateError.message : null);
        return 'upgraded';
      }

      const key = fragmentKey(characterId, rarity);
      const nextCount = (fragmentsRef.current.get(key)?.count ?? 0) + 1;
      const nextMap = new Map(fragmentsRef.current);
      nextMap.set(key, { characterId, rarity, count: nextCount });
      syncFragments(nextMap);
      const { error: upsertError } = await supabase
        .from('character_fragments')
        .upsert({ user_id: userId, character_id: characterId, rarity, count: nextCount }, { onConflict: 'user_id,character_id,rarity' });
      setError(upsertError ? upsertError.message : null);
      return 'duplicate';
    },
    [userId],
  );

  const sellFragment = useCallback(
    async (characterId: string, rarity: Rarity) => {
      if (!userId) return;
      const key = fragmentKey(characterId, rarity);
      const current = fragmentsRef.current.get(key)?.count ?? 0;
      if (current <= 0) return;

      const nextCount = current - 1;
      const nextMap = new Map(fragmentsRef.current);
      if (nextCount <= 0) nextMap.delete(key);
      else nextMap.set(key, { characterId, rarity, count: nextCount });
      syncFragments(nextMap);
      const { error: upsertError } = await supabase
        .from('character_fragments')
        .upsert({ user_id: userId, character_id: characterId, rarity, count: nextCount }, { onConflict: 'user_id,character_id,rarity' });
      setError(upsertError ? upsertError.message : null);
    },
    [userId],
  );

  const refreshFragments = useCallback(async () => {
    if (!userId) return;
    const { data, error: fragError } = await supabase.from('character_fragments').select('character_id, rarity, count').eq('user_id', userId);
    if (fragError) {
      setError(fragError.message);
      return;
    }
    const next = new Map<string, FragmentStack>();
    for (const row of data) {
      if (row.count <= 0) continue;
      const rarity = row.rarity as Rarity;
      next.set(fragmentKey(row.character_id, rarity), { characterId: row.character_id, rarity, count: row.count });
    }
    syncFragments(next);
  }, [userId]);

  return { ownedCharacters, fragments, loading, error, claimStarter, addXp, acquireCharacter, sellFragment, refreshFragments };
}
