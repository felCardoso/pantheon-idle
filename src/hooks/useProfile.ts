import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

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
      const trimmed = newUsername.trim();
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
        return { ok: false, error: '3–20 caracteres: letras, números e underscore.' };
      }

      const { data: existing, error: checkError } = await supabase
        .from('profiles')
        .select('user_id')
        .ilike('username', trimmed)
        .neq('user_id', userId)
        .maybeSingle();
      if (checkError) return { ok: false, error: checkError.message };
      if (existing) return { ok: false, error: 'Esse nome de usuário já está em uso.' };

      const { error: updateError } = await supabase.from('profiles').update({ username: trimmed }).eq('user_id', userId);
      // The unique index is the real race-condition backstop — a concurrent signup/rename
      // between the check above and this update surfaces here as a constraint violation.
      if (updateError) return { ok: false, error: 'Esse nome de usuário já está em uso.' };

      setUsername(trimmed);
      return { ok: true };
    },
    [userId],
  );

  const updateAvatar = useCallback(
    async (characterId: string) => {
      if (!userId) return;
      setAvatarCharacterId(characterId);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_character_id: characterId }).eq('user_id', userId);
      setError(updateError ? updateError.message : null);
    },
    [userId],
  );

  return { username, avatarCharacterId, loading, error, updateUsername, updateAvatar };
}
