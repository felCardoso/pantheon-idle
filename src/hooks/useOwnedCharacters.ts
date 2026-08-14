import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface OwnedCharacter {
  characterId: string;
  /** Accumulated XP — level is always derived from this (see engine/core/leveling.ts), never stored independently. */
  xp: number;
}

export interface UseOwnedCharactersResult {
  /** null while loading. Empty once loaded means the player hasn't picked a starter yet. */
  ownedCharacters: OwnedCharacter[] | null;
  /** Fragment ("diagrama") counts by character id — a gacha pull landing on an already-owned character. Ids with count 0 are omitted. */
  fragments: Record<string, number>;
  loading: boolean;
  /** Non-null if the last load/claim/xp-grant hit an error (e.g. a migration hasn't been run yet) — play continues, just unsaved. */
  error: string | null;
  claimStarter: (characterId: string) => Promise<void>;
  /** Grants the same XP amount to every currently-owned character — the whole owned roster fights together, so everyone who fought earns it. */
  addXp: (amount: number) => void;
  /** A gacha pull landed on characterId: grants ownership if it's new, or +1 fragment if it's already owned. Returns which happened. */
  acquireCharacter: (characterId: string) => Promise<'new' | 'duplicate'>;
  /** Consumes 1 fragment of characterId — the caller is responsible for granting the credit refund (see useBattleSimulation's adjustCredits). */
  sellFragment: (characterId: string) => Promise<void>;
  /** Re-queries character_fragments — call after a Mercado de Diagramas publish/cancel/purchase, since those mutate this row server-side via RPC. */
  refreshFragments: () => Promise<void>;
}

/** Loads and persists which characters a player owns (and their XP/fragments) in `player_characters`/`character_fragments`. */
export function useOwnedCharacters(userId: string | undefined): UseOwnedCharactersResult {
  const [ownedCharacters, setOwnedCharacters] = useState<OwnedCharacter[] | null>(null);
  const [fragments, setFragments] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setOwnedCharacters(null);
      setFragments({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const [charResult, fragResult] = await Promise.all([
        supabase.from('player_characters').select('character_id, xp').eq('user_id', userId),
        supabase.from('character_fragments').select('character_id, count').eq('user_id', userId),
      ]);

      if (cancelled) return;

      if (charResult.error) {
        setError(charResult.error.message);
        setOwnedCharacters([]);
      } else {
        setOwnedCharacters(charResult.data.map((row) => ({ characterId: row.character_id, xp: row.xp })));
      }

      if (fragResult.error) {
        setError((prev) => prev ?? fragResult.error!.message);
      } else {
        setFragments(Object.fromEntries(fragResult.data.filter((row) => row.count > 0).map((row) => [row.character_id, row.count])));
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
      setOwnedCharacters([{ characterId, xp: 0 }]);
      const { error: insertError } = await supabase.from('player_characters').insert({ user_id: userId, character_id: characterId });
      setError(insertError ? insertError.message : null);
    },
    [userId],
  );

  const addXp = useCallback(
    (amount: number) => {
      if (!userId || amount <= 0 || !ownedCharacters || ownedCharacters.length === 0) return;
      const next = ownedCharacters.map((c) => ({ ...c, xp: c.xp + amount }));
      setOwnedCharacters(next);
      supabase
        .from('player_characters')
        .upsert(
          next.map((c) => ({ user_id: userId, character_id: c.characterId, xp: c.xp })),
          { onConflict: 'user_id,character_id' },
        )
        .then(({ error: upsertError }) => setError(upsertError ? upsertError.message : null));
    },
    [userId, ownedCharacters],
  );

  const acquireCharacter = useCallback(
    async (characterId: string): Promise<'new' | 'duplicate'> => {
      if (!userId) return 'duplicate';

      const alreadyOwned = (ownedCharacters ?? []).some((c) => c.characterId === characterId);
      if (!alreadyOwned) {
        setOwnedCharacters((prev) => [...(prev ?? []), { characterId, xp: 0 }]);
        const { error: insertError } = await supabase.from('player_characters').insert({ user_id: userId, character_id: characterId });
        setError(insertError ? insertError.message : null);
        return 'new';
      }

      const nextCount = (fragments[characterId] ?? 0) + 1;
      setFragments((prev) => ({ ...prev, [characterId]: nextCount }));
      const { error: upsertError } = await supabase
        .from('character_fragments')
        .upsert({ user_id: userId, character_id: characterId, count: nextCount }, { onConflict: 'user_id,character_id' });
      setError(upsertError ? upsertError.message : null);
      return 'duplicate';
    },
    [userId, ownedCharacters, fragments],
  );

  const sellFragment = useCallback(
    async (characterId: string) => {
      if (!userId) return;
      const current = fragments[characterId] ?? 0;
      if (current <= 0) return;

      const nextCount = current - 1;
      setFragments((prev) => {
        const next = { ...prev, [characterId]: nextCount };
        if (nextCount <= 0) delete next[characterId];
        return next;
      });
      const { error: upsertError } = await supabase
        .from('character_fragments')
        .upsert({ user_id: userId, character_id: characterId, count: nextCount }, { onConflict: 'user_id,character_id' });
      setError(upsertError ? upsertError.message : null);
    },
    [userId, fragments],
  );

  const refreshFragments = useCallback(async () => {
    if (!userId) return;
    const { data, error: fragError } = await supabase.from('character_fragments').select('character_id, count').eq('user_id', userId);
    if (fragError) {
      setError(fragError.message);
      return;
    }
    setFragments(Object.fromEntries(data.filter((row) => row.count > 0).map((row) => [row.character_id, row.count])));
  }, [userId]);

  return { ownedCharacters, fragments, loading, error, claimStarter, addXp, acquireCharacter, sellFragment, refreshFragments };
}
