import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface UseOwnedCharactersResult {
  /** null while loading. Empty once loaded means the player hasn't picked a starter yet. */
  ownedIds: string[] | null;
  loading: boolean;
  /** Non-null if the last load/claim hit an error (e.g. migration 0002 hasn't been run yet) — play continues, just unsaved. */
  error: string | null;
  claimStarter: (characterId: string) => Promise<void>;
}

/** Loads and persists which characters a player owns, in `player_characters`. */
export function useOwnedCharacters(userId: string | undefined): UseOwnedCharactersResult {
  const [ownedIds, setOwnedIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setOwnedIds(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error: selectError } = await supabase.from('player_characters').select('character_id').eq('user_id', userId);

      if (cancelled) return;

      if (selectError) {
        setError(selectError.message);
        setOwnedIds([]);
        setLoading(false);
        return;
      }

      setOwnedIds(data.map((row) => row.character_id));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const claimStarter = useCallback(
    async (characterId: string) => {
      if (!userId) return;
      setOwnedIds([characterId]);
      const { error: insertError } = await supabase.from('player_characters').insert({ user_id: userId, character_id: characterId });
      setError(insertError ? insertError.message : null);
    },
    [userId],
  );

  return { ownedIds, loading, error, claimStarter };
}
