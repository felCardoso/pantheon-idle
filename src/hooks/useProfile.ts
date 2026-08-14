import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface UseProfileResult {
  /** null while loading, or if this account predates the profiles migration (no in-app "set username" flow yet). */
  username: string | null;
  loading: boolean;
  error: string | null;
}

/** Loads a player's username from `profiles` — set once at signup (see useAuth.signUp + migration 0004's trigger). */
export function useProfile(userId: string | undefined): UseProfileResult {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setUsername(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error: selectError } = await supabase.from('profiles').select('username').eq('user_id', userId).maybeSingle();

      if (cancelled) return;

      if (selectError) {
        setError(selectError.message);
      } else {
        setUsername(data?.username ?? null);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { username, loading, error };
}
