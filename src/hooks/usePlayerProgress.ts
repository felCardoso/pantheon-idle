import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface PlayerProgress {
  fase: number;
  estagio: number;
  credits: number;
  xp: number;
}

export type TeamVisibility = 'pve' | 'pvp' | 'hidden';

const DEFAULT_PROGRESS: PlayerProgress = { fase: 1, estagio: 1, credits: 0, xp: 0 };
const DEFAULT_TOKENS = 300;
const DEFAULT_TEAM_VISIBILITY: TeamVisibility = 'pve';

export interface UsePlayerProgressResult {
  /** null while loading; falls back to DEFAULT_PROGRESS if the row/table isn't there yet. */
  progress: PlayerProgress | null;
  /** Whether the one-time starter credit boost (Loja) has already been claimed. Kept separate from `progress`/`saveProgress` — it's a one-off action, not part of the fase/estagio/wallet sync loop. */
  starterBoostClaimed: boolean;
  /** The hard-currency balance (docs/gdd.md section 9) — real and persisted, spent on things like nickname changes. Kept separate from `progress`/`saveProgress` for the same reason as starterBoostClaimed: it only ever changes via explicit spend actions, never the battle-sync loop. */
  tokens: number;
  /** Which team shows on the (future) public profile. */
  teamVisibility: TeamVisibility;
  loading: boolean;
  /** Non-null if the last load/save hit an error (e.g. the migration hasn't been run yet) — play continues, just unsaved. */
  error: string | null;
  saveProgress: (next: PlayerProgress) => Promise<void>;
  /** Marks the starter boost as claimed — the caller is responsible for actually granting the credits (see useBattleSimulation's adjustCredits). */
  claimStarterBoost: () => Promise<void>;
  /** Deducts tokens if affordable, persists, and returns whether it succeeded. */
  spendTokens: (amount: number) => Promise<boolean>;
  setTeamVisibility: (value: TeamVisibility) => Promise<void>;
}

/** Loads (creating on first login) and persists a player's world position + wallet in `player_progress`. */
export function usePlayerProgress(userId: string | undefined): UsePlayerProgressResult {
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [starterBoostClaimed, setStarterBoostClaimed] = useState(false);
  const [tokens, setTokens] = useState(0);
  const [teamVisibility, setTeamVisibilityState] = useState<TeamVisibility>(DEFAULT_TEAM_VISIBILITY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setProgress(null);
      setStarterBoostClaimed(false);
      setTokens(0);
      setTeamVisibilityState(DEFAULT_TEAM_VISIBILITY);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error: selectError } = await supabase
        .from('player_progress')
        .select('fase, estagio, credits, xp, starter_boost_claimed, tokens, team_visibility')
        .eq('user_id', userId)
        .maybeSingle();

      if (cancelled) return;

      if (selectError) {
        setError(selectError.message);
        setProgress(DEFAULT_PROGRESS);
        setStarterBoostClaimed(false);
        setTokens(DEFAULT_TOKENS);
        setTeamVisibilityState(DEFAULT_TEAM_VISIBILITY);
        setLoading(false);
        return;
      }

      if (data) {
        setProgress({ fase: data.fase, estagio: data.estagio, credits: data.credits, xp: data.xp });
        setStarterBoostClaimed(data.starter_boost_claimed);
        setTokens(data.tokens);
        setTeamVisibilityState((data.team_visibility as TeamVisibility) ?? DEFAULT_TEAM_VISIBILITY);
      } else {
        const { error: insertError } = await supabase
          .from('player_progress')
          .insert({ user_id: userId, ...DEFAULT_PROGRESS });
        if (!cancelled && insertError) setError(insertError.message);
        if (!cancelled) {
          setProgress(DEFAULT_PROGRESS);
          setStarterBoostClaimed(false);
          setTokens(DEFAULT_TOKENS);
          setTeamVisibilityState(DEFAULT_TEAM_VISIBILITY);
        }
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

  const claimStarterBoost = useCallback(async () => {
    if (!userId || starterBoostClaimed) return;
    setStarterBoostClaimed(true);
    const { error: updateError } = await supabase.from('player_progress').update({ starter_boost_claimed: true }).eq('user_id', userId);
    setError(updateError ? updateError.message : null);
  }, [userId, starterBoostClaimed]);

  const spendTokens = useCallback(
    async (amount: number): Promise<boolean> => {
      if (!userId || amount <= 0 || tokens < amount) return false;
      const next = tokens - amount;
      setTokens(next);
      const { error: updateError } = await supabase.from('player_progress').update({ tokens: next }).eq('user_id', userId);
      setError(updateError ? updateError.message : null);
      return true;
    },
    [userId, tokens],
  );

  const setTeamVisibility = useCallback(
    async (value: TeamVisibility) => {
      if (!userId) return;
      setTeamVisibilityState(value);
      const { error: updateError } = await supabase.from('player_progress').update({ team_visibility: value }).eq('user_id', userId);
      setError(updateError ? updateError.message : null);
    },
    [userId],
  );

  return {
    progress,
    starterBoostClaimed,
    tokens,
    teamVisibility,
    loading,
    error,
    saveProgress,
    claimStarterBoost,
    spendTokens,
    setTeamVisibility,
  };
}
