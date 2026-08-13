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
  loading: boolean;
  /** Non-null if the last load/claim/xp-grant hit an error (e.g. a migration hasn't been run yet) — play continues, just unsaved. */
  error: string | null;
  claimStarter: (characterId: string) => Promise<void>;
  /** Grants the same XP amount to every currently-owned character — the whole owned roster fights together, so everyone who fought earns it. */
  addXp: (amount: number) => void;
}

/** Loads and persists which characters a player owns, and their XP, in `player_characters`. */
export function useOwnedCharacters(userId: string | undefined): UseOwnedCharactersResult {
  const [ownedCharacters, setOwnedCharacters] = useState<OwnedCharacter[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setOwnedCharacters(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error: selectError } = await supabase.from('player_characters').select('character_id, xp').eq('user_id', userId);

      if (cancelled) return;

      if (selectError) {
        setError(selectError.message);
        setOwnedCharacters([]);
        setLoading(false);
        return;
      }

      setOwnedCharacters(data.map((row) => ({ characterId: row.character_id, xp: row.xp })));
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

  return { ownedCharacters, loading, error, claimStarter, addXp };
}
