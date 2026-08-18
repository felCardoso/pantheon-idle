import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { postApi } from '../lib/apiClient';

export interface UpdateUsernameResult {
  ok: boolean;
  /** Set when ok is false — a friendly message to show the user (taken, invalid, or a generic failure). */
  error?: string;
}

export interface UseProfileResult {
  /** null while loading, or if this account predates the profiles migration (no in-app "set username" flow yet). */
  username: string | null;
  /** The owned character whose portrait is shown as the avatar — null means no avatar chosen yet (generic placeholder icon). */
  avatarCharacterId: string | null;
  loading: boolean;
  error: string | null;
  /** Checks case-insensitive availability, then updates — costs nothing itself, the caller (ChangeNicknameModal) is responsible for the 250-token charge, only after this succeeds. */
  updateUsername: (newUsername: string) => Promise<UpdateUsernameResult>;
  updateAvatar: (characterId: string) => Promise<void>;
}

/** Loads/updates a player's public profile — username (set once at signup, see useAuth.signUp + migration 0004's trigger) and avatar. */
export function useProfile(userId: string | undefined): UseProfileResult {
  const [username, setUsername] = useState<string | null>(null);
  const [avatarCharacterId, setAvatarCharacterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setUsername(null);
      setAvatarCharacterId(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error: selectError } = await supabase
        .from('profiles')
        .select('username, avatar_character_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (cancelled) return;

      if (selectError) {
        setError(selectError.message);
      } else {
        setUsername(data?.username ?? null);
        setAvatarCharacterId(data?.avatar_character_id ?? null);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const updateUsername = useCallback(
    async (newUsername: string): Promise<UpdateUsernameResult> => {
      if (!userId) return { ok: false, error: 'Não foi possível identificar sua conta.' };
      try {
        const response = await postApi<{ username: string }>('/api/profile/username', { username: newUsername });
        setUsername(response.username);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Não foi possível atualizar o nome de usuário.' };
      }
    },
    [userId],
  );

  const updateAvatar = useCallback(
    async (characterId: string) => {
      if (!userId) return;
      const previous = avatarCharacterId;
      setAvatarCharacterId(characterId);
      try {
        await postApi('/api/profile/avatar', { characterId });
        setError(null);
      } catch (err) {
        setAvatarCharacterId(previous);
        setError(err instanceof Error ? err.message : 'Failed to update avatar');
      }
    },
    [userId, avatarCharacterId],
  );

  return { username, avatarCharacterId, loading, error, updateUsername, updateAvatar };
}
