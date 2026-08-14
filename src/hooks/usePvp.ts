import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { loadCharactersByIds } from '../engine/core/loader';
import { runBattle } from '../engine/core/battle';
import type { OwnedCharacter } from './useOwnedCharacters';

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
  setDefenseTeam: (characters: OwnedCharacter[]) => Promise<void>;
  findOpponents: () => Promise<PvpOpponent[]>;
  /** Runs a full attack against `opponent`'s saved defense team via the same deterministic engine as PvE, persists the result, and returns a summary. Async PvP per docs/gdd.md section 6 — no live opponent connection needed. */
  attack: (opponent: PvpOpponent, attackerRoster: OwnedCharacter[]) => Promise<PvpAttackResult | null>;
}

/** K-factor ELO-ish rating exchange. Ties (draws) count as a defender win — the attacker failed to break through. */
const K_FACTOR = 32;
const REWARD_CREDITS_WIN = 30;
const REWARD_CREDITS_LOSS = 5;

function expectedScore(a: number, b: number): number {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

interface DefenseSnapshotCharacter {
  characterId: string;
  xp: number;
}

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
        setDefenseTeamState(snapshot.map((c) => ({ characterId: c.characterId, xp: c.xp })));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setDefenseTeam = useCallback(
    async (characters: OwnedCharacter[]) => {
      if (!userId) return;
      setDefenseTeamState(characters);
      const snapshot: DefenseSnapshotCharacter[] = characters.map((c) => ({ characterId: c.characterId, xp: c.xp }));
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
    async (opponent: PvpOpponent, attackerRoster: OwnedCharacter[]): Promise<PvpAttackResult | null> => {
      if (!userId || attackerRoster.length === 0) return null;

      const { data: defenseRow } = await supabase.from('pvp_defense_teams').select('characters').eq('user_id', opponent.userId).maybeSingle();
      const defenderSnapshot = ((defenseRow?.characters as unknown as DefenseSnapshotCharacter[]) ?? []);
      if (defenderSnapshot.length === 0) return null;

      const attackers = loadCharactersByIds(attackerRoster.map((c) => ({ id: c.characterId, xp: c.xp })));
      const defenders = loadCharactersByIds(defenderSnapshot.map((c) => ({ id: c.characterId, xp: c.xp })));
      const result = runBattle(attackers, defenders, { seed: Date.now() >>> 0 });
      const won = result.winner === 'allies';

      const expected = expectedScore(rating, opponent.rating);
      const attackerDelta = Math.round(K_FACTOR * ((won ? 1 : 0) - expected));
      const defenderDelta = -attackerDelta;
      const newRating = Math.max(0, rating + attackerDelta);

      const { error: rpcError } = await supabase.rpc('resolve_pvp_attack', {
        p_defender_id: opponent.userId,
        p_winner: won ? 'attacker' : 'defender',
        p_log: result.log,
        p_attacker_rating_delta: attackerDelta,
        p_defender_rating_delta: defenderDelta,
      });
      if (rpcError) {
        setError(rpcError.message);
        return null;
      }

      setRating(newRating);
      if (won) setWins((w) => w + 1);
      else setLosses((l) => l + 1);

      return { won, ratingDelta: attackerDelta, newRating, rewardCredits: won ? REWARD_CREDITS_WIN : REWARD_CREDITS_LOSS };
    },
    [userId, rating],
  );

  return { loading, error, rating, wins, losses, defenseTeam, setDefenseTeam, findOpponents, attack };
}
