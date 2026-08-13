import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface PlayerProgress {
  fase: number;
  estagio: number;
  credits: number;
  xp: number;
}

const DEFAULT_PROGRESS: PlayerProgress = { fase: 1, estagio: 1, credits: 0, xp: 0 };

export interface UsePlayerProgressResult {
  /** null while loading; falls back to DEFAULT_PROGRESS if the row/table isn't there yet. */
  progress: PlayerProgress | null;
  loading: boolean;
  /** Non-null if the last load/save hit an error (e.g. the migration hasn't been run yet) — play continues, just unsaved. */
  error: string | null;
  saveProgress: (next: PlayerProgress) => Promise<void>;
}

/** Loads (creating on first login) and persists a player's world position + wallet in `player_progress`. */
export function usePlayerProgress(userId: string | undefined): UsePlayerProgressResult {
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setProgress(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error: selectError } = await supabase
        .from('player_progress')
        .select('fase, estagio, credits, xp')
        .eq('user_id', userId)
        .maybeSingle();

      if (cancelled) return;

      if (selectError) {
        setError(selectError.message);
        setProgress(DEFAULT_PROGRESS);
        setLoading(false);
        return;
      }

      if (data) {
        setProgress(data);
      } else {
        const { error: insertError } = await supabase
          .from('player_progress')
          .insert({ user_id: userId, ...DEFAULT_PROGRESS });
        if (!cancelled && insertError) setError(insertError.message);
        if (!cancelled) setProgress(DEFAULT_PROGRESS);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const saveProgress = useCallback(
    async (next: PlayerProgress) => {
      if (!userId) return;
      setProgress(next);
      const { error: upsertError } = await supabase.from('player_progress').upsert({ user_id: userId, ...next }, { onConflict: 'user_id' });
      setError(upsertError ? upsertError.message : null);
    },
    [userId],
  );

  return { progress, loading, error, saveProgress };
}
