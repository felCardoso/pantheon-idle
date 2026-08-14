import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface CharacterAbilityProgress {
  characterId: string;
  abilityLevel: number;
  passiveLevel: number;
}

export interface UseCharacterProgressionResult {
  /** Keyed by characterId — characters with no row yet default to ability level 1 / passive level 0 when read (see abilityLevelFor/passiveLevelFor helpers used by callers). */
  progression: Record<string, CharacterAbilityProgress>;
  loading: boolean;
  error: string | null;
  /** Persists a new ability level for characterId — the caller has already validated the rarity gate and deducted Créditos. */
  setAbilityLevel: (characterId: string, level: number) => Promise<void>;
  /** Persists a new passive level for characterId — same caller-validated contract as setAbilityLevel. */
  setPassiveLevel: (characterId: string, level: number) => Promise<void>;
}

/** Loads and persists per-character ability/passive levels (`character_ability_progress`) — shared across every rarity copy of a character a player owns. */
export function useCharacterProgression(userId: string | undefined): UseCharacterProgressionResult {
  const [progression, setProgression] = useState<Record<string, CharacterAbilityProgress>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const progressionRef = useRef<Record<string, CharacterAbilityProgress>>({});

  useEffect(() => {
    if (!userId) {
      progressionRef.current = {};
      setProgression({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error: selectError } = await supabase
        .from('character_ability_progress')
        .select('character_id, ability_level, passive_level')
        .eq('user_id', userId);

      if (cancelled) return;

      if (selectError) {
        setError(selectError.message);
      } else {
        const next = Object.fromEntries(
          data.map((row) => [row.character_id, { characterId: row.character_id, abilityLevel: row.ability_level, passiveLevel: row.passive_level }]),
        );
        progressionRef.current = next;
        setProgression(next);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setAbilityLevel = useCallback(
    async (characterId: string, level: number) => {
      if (!userId) return;
      const current = progressionRef.current[characterId] ?? { characterId, abilityLevel: 1, passiveLevel: 0 };
      const next = { ...progressionRef.current, [characterId]: { ...current, abilityLevel: level } };
      progressionRef.current = next;
      setProgression(next);
      const { error: upsertError } = await supabase
        .from('character_ability_progress')
        .upsert(
          { user_id: userId, character_id: characterId, ability_level: level, passive_level: current.passiveLevel },
          { onConflict: 'user_id,character_id' },
        );
      setError(upsertError ? upsertError.message : null);
    },
    [userId],
  );

  const setPassiveLevel = useCallback(
    async (characterId: string, level: number) => {
      if (!userId) return;
      const current = progressionRef.current[characterId] ?? { characterId, abilityLevel: 1, passiveLevel: 0 };
      const next = { ...progressionRef.current, [characterId]: { ...current, passiveLevel: level } };
      progressionRef.current = next;
      setProgression(next);
      const { error: upsertError } = await supabase
        .from('character_ability_progress')
        .upsert(
          { user_id: userId, character_id: characterId, ability_level: current.abilityLevel, passive_level: level },
          { onConflict: 'user_id,character_id' },
        );
      setError(upsertError ? upsertError.message : null);
    },
    [userId],
  );

  return { progression, loading, error, setAbilityLevel, setPassiveLevel };
}
