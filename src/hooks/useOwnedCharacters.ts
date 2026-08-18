import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { postApi } from '../lib/apiClient';
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
  /** Sells 1 fragment of characterId at the given rarity for Bytes via /api/characters/sell-fragment
   * — returns the grant + new Bytes total (for the caller's usePlayerProgress.setBytesFromServer),
   * or null if it failed (nothing to sell). */
  sellFragment: (characterId: string, rarity: Rarity) => Promise<{ grantedBytes: number; bytes: number } | null>;
  /** Re-queries character_fragments — call after a Mercado de Diagramas publish/cancel/purchase, since those mutate this row server-side via RPC. */
  refreshFragments: () => Promise<void>;
}

function fragmentKey(characterId: string, rarity: Rarity): string {
  return `${characterId}:${rarity}`;
}

/** Loads and persists which characters a player owns (and their XP/rarity/fragments) in `player_characters`/`character_fragments`. */
export function useOwnedCharacters(userId: string | undefined): UseOwnedCharactersResult {
  const [ownedCharacters, setOwnedCharacters] = useState<OwnedCharacter[] | null>(null);
  const [fragments, setFragments] = useState<FragmentStack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mirrors of the state above, written synchronously wherever the state is written — see
  // addXp's own comment for why (battle-driven, unrelated to the routes below, kept as-is).
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
      try {
        const response = await postApi<{ characterId: string; rarity: Rarity }>('/api/characters/claim-starter', { characterId });
        const owned = [{ characterId: response.characterId, xp: 0, rarity: response.rarity }];
        ownedRef.current = owned;
        setOwnedCharacters(owned);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to claim starter character');
      }
    },
    [userId],
  );

  // Battle-driven (every owned character levels up from battle rewards) — not migrated yet,
  // same reasoning as usePlayerProgress.ts's saveProgress: it means moving battle resolution
  // itself server-side, out of scope for this pass.
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

  const sellFragment = useCallback(
    async (characterId: string, rarity: Rarity): Promise<{ grantedBytes: number; bytes: number } | null> => {
      if (!userId) return null;
      const key = fragmentKey(characterId, rarity);
      const current = fragmentsRef.current.get(key)?.count ?? 0;
      if (current <= 0) return null;

      try {
        const response = await postApi<{ grantedBytes: number; bytes: number; remainingCount: number }>('/api/characters/sell-fragment', {
          characterId,
          rarity,
        });
        const nextMap = new Map(fragmentsRef.current);
        if (response.remainingCount <= 0) nextMap.delete(key);
        else nextMap.set(key, { characterId, rarity, count: response.remainingCount });
        syncFragments(nextMap);
        setError(null);
        return { grantedBytes: response.grantedBytes, bytes: response.bytes };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to sell fragment');
        return null;
      }
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

  return { ownedCharacters, fragments, loading, error, claimStarter, addXp, sellFragment, refreshFragments };
}
