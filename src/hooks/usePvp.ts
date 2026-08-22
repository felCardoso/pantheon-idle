import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { postApi } from '../lib/apiClient';
import type { OwnedCharacter } from './useOwnedCharacters';
import type { Rarity } from '../types';
import type { Row } from '../engine';

export interface PvpOpponent {
  userId: string;
  username: string;
  rating: number;
}

/** One row of the global PvP leaderboard (supabase/migrations/0018_pvp_ranking.sql's get_pvp_leaderboard). */
export interface PvpLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  rating: number;
  peakRating: number;
  wins: number;
  losses: number;
}

/** The caller's own leaderboard position, independent of whether they're in the top-N slice fetched by fetchLeaderboard. */
export interface MyPvpRank {
  rank: number;
  total: number;
}

export interface UsePvpResult {
  loading: boolean;
  error: string | null;
  rating: number;
  /** Highest rating ever reached — never drops on a loss, unlike `rating` (see player_progress.pvp_peak_rating). */
  peakRating: number;
  wins: number;
  losses: number;
  /** The player's own saved defense squad — what an attacker actually fights. Empty until set. */
  defenseTeam: OwnedCharacter[];
  /** Row (front/back) for each member of `defenseTeam`, by character id — missing entries default to 'front' (src/engine/turn/formation.ts). */
  defenseFormation: Record<string, Row>;
  /**
   * `selectedAbilityByCharacterId` is saved into the snapshot alongside each character
   * (docs/gdd.md §6: "defensor luta com o que salvou por último") — omit an id to snapshot
   * activeOptions[0] for that character, same default the engine applies everywhere else.
   * `formation` omits an id to default it to 'front'.
   */
  setDefenseTeam: (
    characters: OwnedCharacter[],
    selectedAbilityByCharacterId?: Record<string, string>,
    formation?: Record<string, Row>,
  ) => Promise<void>;
  /** Top `limit` (default 50, capped at 200 server-side) players by rating — supabase/migrations/0018_pvp_ranking.sql's get_pvp_leaderboard, security definer since player_progress's RLS only lets a client read its own row. */
  fetchLeaderboard: (limit?: number) => Promise<PvpLeaderboardEntry[]>;
  /** The caller's own position + total ranked player count — useful when they're not in the leaderboard's top-N slice. */
  fetchMyRank: () => Promise<MyPvpRank | null>;
}

interface DefenseSnapshotCharacter {
  characterId: string;
  xp: number;
  rarity?: Rarity;
  selectedAbilityId?: string;
}

/** Old defense snapshots (saved before rarity existed) fall back here — combat itself never reads rarity, only display does. */
const SNAPSHOT_FALLBACK_RARITY: Rarity = 'Alpha';

export function usePvp(userId: string | undefined): UsePvpResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(1000);
  const [peakRating, setPeakRating] = useState(1000);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [defenseTeam, setDefenseTeamState] = useState<OwnedCharacter[]>([]);
  const [defenseFormation, setDefenseFormationState] = useState<Record<string, Row>>({});

  useEffect(() => {
    if (!userId) {
      setRating(1000);
      setPeakRating(1000);
      setWins(0);
      setLosses(0);
      setDefenseTeamState([]);
      setDefenseFormationState({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const [{ data: progress, error: progressError }, { data: defense }] = await Promise.all([
        supabase.from('player_progress').select('pvp_rating, pvp_peak_rating, pvp_wins, pvp_losses').eq('user_id', userId).maybeSingle(),
        supabase.from('pvp_defense_teams').select('characters, formation').eq('user_id', userId).maybeSingle(),
      ]);
      if (cancelled) return;
      if (progressError) setError(progressError.message);
      if (progress) {
        setRating(progress.pvp_rating);
        setPeakRating(progress.pvp_peak_rating);
        setWins(progress.pvp_wins);
        setLosses(progress.pvp_losses);
      }
      if (defense?.characters) {
        const snapshot = defense.characters as unknown as DefenseSnapshotCharacter[];
        setDefenseTeamState(snapshot.map((c) => ({ characterId: c.characterId, xp: c.xp, rarity: c.rarity ?? SNAPSHOT_FALLBACK_RARITY })));
      }
      setDefenseFormationState((defense?.formation as unknown as Record<string, Row>) ?? {});
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setDefenseTeam = useCallback(
    async (characters: OwnedCharacter[], selectedAbilityByCharacterId: Record<string, string> = {}, formation: Record<string, Row> = {}) => {
      if (!userId) return;
      setDefenseTeamState(characters);
      setDefenseFormationState(formation);
      try {
        // xp/rarity aren't sent — /api/pvp/defense-team re-reads them from player_characters
        // itself, so a forged snapshot can't hand a defense team fabricated stats.
        await postApi('/api/pvp/defense-team', { characterIds: characters.map((c) => c.characterId), selectedAbilityByCharacterId, formation });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save defense team');
      }
    },
    [userId],
  );

  const fetchLeaderboard = useCallback(async (limit = 50): Promise<PvpLeaderboardEntry[]> => {
    const { data, error: rpcError } = await supabase.rpc('get_pvp_leaderboard', { p_limit: limit });
    if (rpcError) {
      setError(rpcError.message);
      return [];
    }
    return (data ?? []).map((row) => ({
      rank: row.rank,
      userId: row.user_id,
      username: row.username,
      rating: row.pvp_rating,
      peakRating: row.pvp_peak_rating,
      wins: row.pvp_wins,
      losses: row.pvp_losses,
    }));
  }, []);

  const fetchMyRank = useCallback(async (): Promise<MyPvpRank | null> => {
    if (!userId) return null;
    const { data, error: rpcError } = await supabase.rpc('get_my_pvp_rank');
    if (rpcError || !data || data.length === 0) {
      if (rpcError) setError(rpcError.message);
      return null;
    }
    return { rank: data[0].rank, total: data[0].total };
  }, [userId]);

  return {
    loading,
    error,
    rating,
    peakRating,
    wins,
    losses,
    defenseTeam,
    defenseFormation,
    setDefenseTeam,
    fetchLeaderboard,
    fetchMyRank,
  };
}
