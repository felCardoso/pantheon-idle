import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { postApi } from '../lib/apiClient';

export interface TeamSlot {
  slot: number;
  name: string;
  characterIds: string[];
}

export interface UsePlayerTeamsResult {
  /** Always 5 entries (slot 1-5) — a slot never touched yet is filled in client-side as an empty, default-named team. */
  teams: TeamSlot[];
  loading: boolean;
  error: string | null;
  renameTeam: (slot: number, name: string) => Promise<void>;
  /** Full replace of a team's members, clamped to MAX_TEAM_MEMBERS. */
  setTeamCharacters: (slot: number, characterIds: string[]) => Promise<void>;
  /** Seeds all 5 slots with [starterCharacterId] — call once, right after onboarding's claimStarter. */
  initializeAllTeams: (starterCharacterId: string) => Promise<void>;
  /** Appends characterId to Time1 if it has room — call after a gacha pull resolves to 'new'. */
  autoAddToTeam1: (characterId: string) => Promise<void>;
}

/** docs/combate.md section 1: "Times de até 5 personagens por lado." */
export const MAX_TEAM_MEMBERS = 5;
const TOTAL_SLOTS = 5;

function defaultTeam(slot: number): TeamSlot {
  return { slot, name: `Time${slot}.cfg`, characterIds: [] };
}

/** Loads and persists a player's 5 saved team loadouts ("`.cfg`", docs/gdd.md line 92) in `player_teams`. */
export function usePlayerTeams(userId: string | undefined): UsePlayerTeamsResult {
  const [teams, setTeams] = useState<TeamSlot[]>(() => Array.from({ length: TOTAL_SLOTS }, (_, i) => defaultTeam(i + 1)));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setTeams(Array.from({ length: TOTAL_SLOTS }, (_, i) => defaultTeam(i + 1)));
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error: selectError } = await supabase.from('player_teams').select('slot, name, characters').eq('user_id', userId);
      if (cancelled) return;

      if (selectError) {
        setError(selectError.message);
        setTeams(Array.from({ length: TOTAL_SLOTS }, (_, i) => defaultTeam(i + 1)));
        setLoading(false);
        return;
      }

      const bySlot = new Map((data ?? []).map((row) => [row.slot, row]));
      setTeams(
        Array.from({ length: TOTAL_SLOTS }, (_, i) => {
          const slot = i + 1;
          const row = bySlot.get(slot);
          return row ? { slot, name: row.name, characterIds: (row.characters as unknown as string[]) ?? [] } : defaultTeam(slot);
        }),
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const renameTeam = useCallback(
    async (slot: number, name: string) => {
      const trimmed = name.trim();
      if (!userId || !trimmed) return;
      setTeams((prev) => prev.map((t) => (t.slot === slot ? { ...t, name: trimmed } : t)));
      try {
        await postApi('/api/teams/save', { slot, name: trimmed });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to rename team');
      }
    },
    [userId],
  );

  const setTeamCharacters = useCallback(
    async (slot: number, characterIds: string[]) => {
      if (!userId) return;
      const clamped = characterIds.slice(0, MAX_TEAM_MEMBERS);
      setTeams((prev) => prev.map((t) => (t.slot === slot ? { ...t, characterIds: clamped } : t)));
      try {
        await postApi('/api/teams/save', { slot, characterIds: clamped });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save team');
      }
    },
    [userId],
  );

  const initializeAllTeams = useCallback(
    async (starterCharacterId: string) => {
      if (!userId) return;
      const next = Array.from({ length: TOTAL_SLOTS }, (_, i) => ({
        slot: i + 1,
        name: `Time${i + 1}.cfg`,
        characterIds: [starterCharacterId],
      }));
      setTeams(next);
      try {
        await postApi('/api/teams/initialize', { starterCharacterId });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize teams');
      }
    },
    [userId],
  );

  const autoAddToTeam1 = useCallback(
    async (characterId: string) => {
      if (!userId) return;
      let willAdd = false;
      setTeams((prev) =>
        prev.map((t) => {
          if (t.slot !== 1) return t;
          if (t.characterIds.includes(characterId) || t.characterIds.length >= MAX_TEAM_MEMBERS) return t;
          willAdd = true;
          return { ...t, characterIds: [...t.characterIds, characterId] };
        }),
      );
      if (!willAdd) return;
      try {
        await postApi('/api/teams/auto-add', { characterId });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to auto-add character');
      }
    },
    [userId],
  );

  return { teams, loading, error, renameTeam, setTeamCharacters, initializeAllTeams, autoAddToTeam1 };
}
