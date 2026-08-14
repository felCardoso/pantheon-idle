import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

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

  const persistTeam = useCallback(
    async (slot: number, name: string, characterIds: string[]) => {
      if (!userId) return;
      const { error: upsertError } = await supabase
        .from('player_teams')
        .upsert({ user_id: userId, slot, name, characters: characterIds, updated_at: new Date().toISOString() }, { onConflict: 'user_id,slot' });
      if (upsertError) setError(upsertError.message);
    },
    [userId],
  );

  const renameTeam = useCallback(
    async (slot: number, name: string) => {
      const trimmed = name.trim();
      if (!userId || !trimmed) return;
      let charactersToPersist: string[] = [];
      setTeams((prev) =>
        prev.map((t) => {
          if (t.slot !== slot) return t;
          charactersToPersist = t.characterIds;
          return { ...t, name: trimmed };
        }),
      );
      await persistTeam(slot, trimmed, charactersToPersist);
    },
    [userId, persistTeam],
  );

  const setTeamCharacters = useCallback(
    async (slot: number, characterIds: string[]) => {
      if (!userId) return;
      const clamped = characterIds.slice(0, MAX_TEAM_MEMBERS);
      let name = `Time${slot}.cfg`;
      setTeams((prev) =>
        prev.map((t) => {
          if (t.slot !== slot) return t;
          name = t.name;
          return { ...t, characterIds: clamped };
        }),
      );
      await persistTeam(slot, name, clamped);
    },
    [userId, persistTeam],
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
      const rows = next.map((t) => ({
        user_id: userId,
        slot: t.slot,
        name: t.name,
        characters: t.characterIds,
        updated_at: new Date().toISOString(),
      }));
      const { error: upsertError } = await supabase.from('player_teams').upsert(rows, { onConflict: 'user_id,slot' });
      if (upsertError) setError(upsertError.message);
    },
    [userId],
  );

  const autoAddToTeam1 = useCallback(
    async (characterId: string) => {
      if (!userId) return;
      let nextCharacters: string[] | null = null;
      let name = 'Time1.cfg';
      setTeams((prev) =>
        prev.map((t) => {
          if (t.slot !== 1) return t;
          name = t.name;
          if (t.characterIds.includes(characterId) || t.characterIds.length >= MAX_TEAM_MEMBERS) return t;
          nextCharacters = [...t.characterIds, characterId];
          return { ...t, characterIds: nextCharacters };
        }),
      );
      if (nextCharacters) await persistTeam(1, name, nextCharacters);
    },
    [userId, persistTeam],
  );

  return { teams, loading, error, renameTeam, setTeamCharacters, initializeAllTeams, autoAddToTeam1 };
}
