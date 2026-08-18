import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { postApi } from '../lib/apiClient';
import type { OwnedCharacter } from './useOwnedCharacters';
import type { BattleLogEntry, Combatant } from '../engine';
import type { Rarity } from '../types';

export interface PvpOpponent {
  userId: string;
  username: string;
  rating: number;
}

export interface PvpAttackResult {
  won: boolean;
  ratingDelta: number;
  newRating: number;
  rewardCredits: number;
  /** The fight itself, computed server-side (supabase/functions/pvp-attack) — feed straight into useBattleReplay to actually show it instead of just the outcome. */
  log: BattleLogEntry[];
  attackers: Combatant[];
  defenders: Combatant[];
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
  /** `selectedAbilityByCharacterId` is saved into the snapshot alongside each character (docs/gdd.md §6: "defensor luta com o que salvou por último") — omit an id to snapshot activeOptions[0] for that character, same default the engine applies everywhere else. */
  setDefenseTeam: (characters: OwnedCharacter[], selectedAbilityByCharacterId?: Record<string, string>) => Promise<void>;
  findOpponents: () => Promise<PvpOpponent[]>;
  /**
   * Runs a full attack against `opponent`'s saved defense team, entirely
   * server-side via the `pvp-attack` Supabase Edge Function — the result
   * affects a real opponent's rating, so the battle can't be computed (and
   * trusted) in the attacker's own browser. The function fetches the
   * attacker's roster itself from `player_characters`; nothing about the
   * attacker's team is sent from the client.
   */
  attack: (opponent: PvpOpponent) => Promise<PvpAttackResult | null>;
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

  useEffect(() => {
    if (!userId) {
      setRating(1000);
      setPeakRating(1000);
      setWins(0);
      setLosses(0);
      setDefenseTeamState([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const [{ data: progress, error: progressError }, { data: defense }] = await Promise.all([
        supabase.from('player_progress').select('pvp_rating, pvp_peak_rating, pvp_wins, pvp_losses').eq('user_id', userId).maybeSingle(),
        supabase.from('pvp_defense_teams').select('characters').eq('user_id', userId).maybeSingle(),
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
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setDefenseTeam = useCallback(
    async (characters: OwnedCharacter[], selectedAbilityByCharacterId: Record<string, string> = {}) => {
      if (!userId) return;
      setDefenseTeamState(characters);
      try {
        // xp/rarity aren't sent — /api/pvp/defense-team re-reads them from player_characters
        // itself, so a forged snapshot can't hand a defense team fabricated stats.
        await postApi('/api/pvp/defense-team', { characterIds: characters.map((c) => c.characterId), selectedAbilityByCharacterId });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save defense team');
      }
    },
    [userId],
  );

  const findOpponents = useCallback(async (): Promise<PvpOpponent[]> => {
    if (!userId) return [];
    const { data: defenses } = await supabase.from('pvp_defense_teams').select('user_id').neq('user_id', userId).limit(50);
    const candidateIds = (defenses ?? []).map((d) => d.user_id);
    if (candidateIds.length === 0) return [];

    // player_progress's own RLS only lets a client read its own row, so
    // ratings for other candidates come from a security-definer RPC —
    // see supabase/migrations/0018_pvp_ranking.sql's get_pvp_ratings.
    const [{ data: ratings }, { data: profiles }] = await Promise.all([
      supabase.rpc('get_pvp_ratings', { p_user_ids: candidateIds }),
      supabase.from('profiles').select('user_id, username').in('user_id', candidateIds),
    ]);
    const ratingByUser = Object.fromEntries((ratings ?? []).map((r) => [r.user_id, r.pvp_rating]));
    const nameByUser = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p.username]));

    return candidateIds
      .map((id) => ({ userId: id, username: nameByUser[id] ?? 'Node', rating: ratingByUser[id] ?? 1000 }))
      .sort((a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating))
      .slice(0, 10);
  }, [userId, rating]);

  const attack = useCallback(
    async (opponent: PvpOpponent): Promise<PvpAttackResult | null> => {
      if (!userId) return null;

      const { data, error: invokeError } = await supabase.functions.invoke<PvpAttackResult>('pvp-attack', {
        body: { defenderId: opponent.userId },
      });
      if (invokeError || !data) {
        setError(invokeError?.message ?? 'Attack failed');
        return null;
      }

      setRating(data.newRating);
      setPeakRating((p) => Math.max(p, data.newRating));
      if (data.won) setWins((w) => w + 1);
      else setLosses((l) => l + 1);

      return data;
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
    setDefenseTeam,
    findOpponents,
    attack,
    fetchLeaderboard,
    fetchMyRank,
  };
}
