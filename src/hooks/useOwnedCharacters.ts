import { useCallback, useEffect, useRef, useState } from 'react';
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

  // Mirrors of the state above, written synchronously wherever the state is written. React
  // state updates aren't visible to the very next synchronous-ish call in the same tick (no
  // render has happened yet), which matters here because acquireCharacter can be called
  // back-to-back for a batch of gacha pulls (see GachaPage's 10x option) — two pulls landing on
  // the same already-owned character in one batch would both read the same stale fragment count
  // from state and silently drop an increment. Reading/writing through these refs instead keeps
  // every call correct regardless of render timing.
  const ownedRef = useRef<OwnedCharacter[]>([]);
  const fragmentsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!userId) {
      ownedRef.current = [];
      fragmentsRef.current = {};
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
        ownedRef.current = [];
        setOwnedCharacters([]);
      } else {
        const owned = charResult.data.map((row) => ({ characterId: row.character_id, xp: row.xp }));
        ownedRef.current = owned;
        setOwnedCharacters(owned);
      }

      if (fragResult.error) {
        setError((prev) => prev ?? fragResult.error!.message);
      } else {
        const frags = Object.fromEntries(fragResult.data.filter((row) => row.count > 0).map((row) => [row.character_id, row.count]));
        fragmentsRef.current = frags;
        setFragments(frags);
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
      const owned = [{ characterId, xp: 0 }];
      ownedRef.current = owned;
      setOwnedCharacters(owned);
      const { error: insertError } = await supabase.from('player_characters').insert({ user_id: userId, character_id: characterId });
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
          next.map((c) => ({ user_id: userId, character_id: c.characterId, xp: c.xp })),
          { onConflict: 'user_id,character_id' },
        )
        .then(({ error: upsertError }) => setError(upsertError ? upsertError.message : null));
    },
    [userId],
  );

  const acquireCharacter = useCallback(
    async (characterId: string): Promise<'new' | 'duplicate'> => {
      if (!userId) return 'duplicate';

      const alreadyOwned = ownedRef.current.some((c) => c.characterId === characterId);
      if (!alreadyOwned) {
        const next = [...ownedRef.current, { characterId, xp: 0 }];
        ownedRef.current = next;
        setOwnedCharacters(next);
        const { error: insertError } = await supabase.from('player_characters').insert({ user_id: userId, character_id: characterId });
        setError(insertError ? insertError.message : null);
        return 'new';
      }

      const nextCount = (fragmentsRef.current[characterId] ?? 0) + 1;
      const nextFragments = { ...fragmentsRef.current, [characterId]: nextCount };
      fragmentsRef.current = nextFragments;
      setFragments(nextFragments);
      const { error: upsertError } = await supabase
        .from('character_fragments')
        .upsert({ user_id: userId, character_id: characterId, count: nextCount }, { onConflict: 'user_id,character_id' });
      setError(upsertError ? upsertError.message : null);
      return 'duplicate';
    },
    [userId],
  );

  const sellFragment = useCallback(
    async (characterId: string) => {
      if (!userId) return;
      const current = fragmentsRef.current[characterId] ?? 0;
      if (current <= 0) return;

      const nextCount = current - 1;
      const next = { ...fragmentsRef.current, [characterId]: nextCount };
      if (nextCount <= 0) delete next[characterId];
      fragmentsRef.current = next;
      setFragments(next);
      const { error: upsertError } = await supabase
        .from('character_fragments')
        .upsert({ user_id: userId, character_id: characterId, count: nextCount }, { onConflict: 'user_id,character_id' });
      setError(upsertError ? upsertError.message : null);
    },
    [userId],
  );

  const refreshFragments = useCallback(async () => {
    if (!userId) return;
    const { data, error: fragError } = await supabase.from('character_fragments').select('character_id, count').eq('user_id', userId);
    if (fragError) {
      setError(fragError.message);
      return;
    }
    const frags = Object.fromEntries(data.filter((row) => row.count > 0).map((row) => [row.character_id, row.count]));
    fragmentsRef.current = frags;
    setFragments(frags);
  }, [userId]);

  return { ownedCharacters, fragments, loading, error, claimStarter, addXp, acquireCharacter, sellFragment, refreshFragments };
}
