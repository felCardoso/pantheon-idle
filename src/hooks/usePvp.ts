import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { OwnedCharacter } from './useOwnedCharacters';
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
}

export interface UsePvpResult {
  loading: boolean;
  error: string | null;
  rating: number;
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
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [defenseTeam, setDefenseTeamState] = useState<OwnedCharacter[]>([]);

  useEffect(() => {
    if (!userId) {
      setRating(1000);
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
        supabase.from('player_progress').select('pvp_rating, pvp_wins, pvp_losses').eq('user_id', userId).maybeSingle(),
        supabase.from('pvp_defense_teams').select('characters').eq('user_id', userId).maybeSingle(),
      ]);
      if (cancelled) return;
      if (progressError) setError(progressError.message);
      if (progress) {
        setRating(progress.pvp_rating);
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
      const snapshot: DefenseSnapshotCharacter[] = characters.map((c) => ({
        characterId: c.characterId,
        xp: c.xp,
        rarity: c.rarity,
        selectedAbilityId: selectedAbilityByCharacterId[c.characterId],
      }));
      const { error: upsertError } = await supabase
        .from('pvp_defense_teams')
        .upsert({ user_id: userId, characters: snapshot, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (upsertError) setError(upsertError.message);
    },
    [userId],
  );

  const findOpponents = useCallback(async (): Promise<PvpOpponent[]> => {
    if (!userId) return [];
    const { data: defenses } = await supabase.from('pvp_defense_teams').select('user_id').neq('user_id', userId).limit(50);
    const candidateIds = (defenses ?? []).map((d) => d.user_id);
    if (candidateIds.length === 0) return [];

    const [{ data: progresses }, { data: profiles }] = await Promise.all([
      supabase.from('player_progress').select('user_id, pvp_rating').in('user_id', candidateIds),
      supabase.from('profiles').select('user_id, username').in('user_id', candidateIds),
    ]);
    const ratingByUser = Object.fromEntries((progresses ?? []).map((p) => [p.user_id, p.pvp_rating]));
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
      if (data.won) setWins((w) => w + 1);
      else setLosses((l) => l + 1);

      return data;
    },
    [userId],
  );

  return { loading, error, rating, wins, losses, defenseTeam, setDefenseTeam, findOpponents, attack };
}
