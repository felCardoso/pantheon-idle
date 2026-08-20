import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { postApi } from '../lib/apiClient';

export interface CharacterAbilityProgress {
  characterId: string;
  abilityLevel: number;
  /** The bench kit's own track — separate from abilityLevel since migration 0025. */
  benchLevel: number;
  passiveLevel: number;
  /** Tenths: 10 = v1.0, 20 = v2.0. Gates the passive (see data/characterVersion.ts). */
  version: number;
  /** The player's equipped active ability id, or null if they haven't chosen one yet (falls back to activeOptions[0] — see loader.ts's resolveCombatantAbilities). */
  selectedAbilityId: string | null;
}

interface UpgradeResponse {
  abilityLevel: number;
  benchLevel: number;
  passiveLevel: number;
  credits: number;
}

interface VersionUpgradeResponse {
  version: number;
}

/** A character with no row yet: level 1 kits, no passive, v1.0, no explicit ability choice. */
const DEFAULT_PROGRESS = (characterId: string): CharacterAbilityProgress => ({
  characterId,
  abilityLevel: 1,
  benchLevel: 1,
  passiveLevel: 0,
  version: 10,
  selectedAbilityId: null,
});

export interface UseCharacterProgressionResult {
  /** Keyed by characterId — characters with no row yet default to ability level 1 / passive level 0 / no explicit selection when read (see abilityLevelFor/passiveLevelFor helpers used by callers). */
  progression: Record<string, CharacterAbilityProgress>;
  loading: boolean;
  error: string | null;
  /** Upgrades characterId's ability level by exactly one step via /api/characters/ability — the
   * server validates the rarity gate and deducts credits itself; returns the new credits total
   * (for the caller's battle.setWallet) or null if it failed (max level, can't afford, etc). */
  upgradeAbility: (characterId: string) => Promise<number | null>;
  /** Same contract as upgradeAbility, for the bench track. */
  upgradeBench: (characterId: string) => Promise<number | null>;
  /** Same contract as upgradeAbility, for the passive track. */
  upgradePassive: (characterId: string) => Promise<number | null>;
  /** Spends fragments to take the character one version step. Returns the new version, or null. */
  upgradeVersion: (characterId: string) => Promise<number | null>;
  /** Persists which of the character's activeOptions is equipped — no rarity/cost gate, unlike the two above (docs/combate.md §5: swapping actives is free). */
  setSelectedAbility: (characterId: string, abilityId: string) => Promise<void>;
}

/** Keyed by characterId, only for characters with an explicit selection — the shape loader.ts's OwnedCharacterEntry.selectedAbilityId / the pvp defense-team snapshot both want. Shared by GameShell.tsx (PvE) and TeamPage.tsx (PvP defense snapshot) so the derivation isn't duplicated. */
export function selectedAbilityMapFrom(progression: Record<string, CharacterAbilityProgress>): Record<string, string> {
  const entries = Object.values(progression)
    .filter((p) => p.selectedAbilityId)
    .map((p) => [p.characterId, p.selectedAbilityId as string] as const);
  return Object.fromEntries(entries);
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
        .select('character_id, ability_level, bench_level, passive_level, character_version, selected_ability_id')
        .eq('user_id', userId);

      if (cancelled) return;

      if (selectError) {
        setError(selectError.message);
      } else {
        const next = Object.fromEntries(
          data.map((row) => [
            row.character_id,
            {
              characterId: row.character_id,
              abilityLevel: row.ability_level,
              benchLevel: row.bench_level,
              passiveLevel: row.passive_level,
              version: row.character_version,
              selectedAbilityId: row.selected_ability_id,
            },
          ]),
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

  const upgrade = useCallback(
    async (characterId: string, kind: 'ability' | 'bench' | 'passive'): Promise<number | null> => {
      if (!userId) return null;
      try {
        const response = await postApi<UpgradeResponse>('/api/characters/ability', { characterId, kind });
        const current = progressionRef.current[characterId] ?? DEFAULT_PROGRESS(characterId);
        const next = {
          ...progressionRef.current,
          [characterId]: { ...current, abilityLevel: response.abilityLevel, benchLevel: response.benchLevel, passiveLevel: response.passiveLevel },
        };
        progressionRef.current = next;
        setProgression(next);
        setError(null);
        return response.credits;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upgrade');
        return null;
      }
    },
    [userId],
  );

  const upgradeAbility = useCallback((characterId: string) => upgrade(characterId, 'ability'), [upgrade]);
  const upgradeBench = useCallback((characterId: string) => upgrade(characterId, 'bench'), [upgrade]);
  const upgradePassive = useCallback((characterId: string) => upgrade(characterId, 'passive'), [upgrade]);

  const upgradeVersion = useCallback(
    async (characterId: string): Promise<number | null> => {
      if (!userId) return null;
      try {
        const response = await postApi<VersionUpgradeResponse>('/api/characters/upgrade-version', { characterId });
        const current = progressionRef.current[characterId] ?? DEFAULT_PROGRESS(characterId);
        const next = { ...progressionRef.current, [characterId]: { ...current, version: response.version } };
        progressionRef.current = next;
        setProgression(next);
        setError(null);
        return response.version;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível evoluir a versão.');
        return null;
      }
    },
    [userId],
  );

  const setSelectedAbility = useCallback(
    async (characterId: string, abilityId: string) => {
      if (!userId) return;
      const current = progressionRef.current[characterId] ?? DEFAULT_PROGRESS(characterId);
      const next = { ...progressionRef.current, [characterId]: { ...current, selectedAbilityId: abilityId } };
      progressionRef.current = next;
      setProgression(next);
      try {
        await postApi('/api/characters/selected-ability', { characterId, abilityId });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to set selected ability');
      }
    },
    [userId],
  );

  return { progression, loading, error, upgradeAbility, upgradeBench, upgradePassive, upgradeVersion, setSelectedAbility };
}
