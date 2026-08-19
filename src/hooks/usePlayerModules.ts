import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { postApi } from '../lib/apiClient';
import type { ModuleRarity, ModuleSlot } from '../data/modules';

/** One owned copy of a rune. `equippedOn` is the character id wearing it, or null in the inventory. */
export interface OwnedModule {
  id: string;
  moduleId: string;
  rarity: ModuleRarity;
  slot: ModuleSlot;
  equippedOn: string | null;
}

export interface UsePlayerModulesResult {
  modules: OwnedModule[];
  loading: boolean;
  error: string | null;
  /** Equips a copy on a character, replacing whatever occupied that slot. Pass null to unequip. */
  equip: (moduleRowId: string, characterId: string | null) => Promise<void>;
  /** Re-reads from the server — call after a capsule pull or a boss drop. */
  refresh: () => Promise<void>;
}

/**
 * The player's Módulos (`.dll`).
 *
 * Read directly (RLS scopes the select to the owner), but every write goes through
 * app/api/modules/** — migration 0025 gives the client no insert or update on this table at all,
 * since a rune is combat power.
 */
export function usePlayerModules(userId: string | undefined): UsePlayerModulesResult {
  const [modules, setModules] = useState<OwnedModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setModules([]);
      setLoading(false);
      return;
    }
    const { data, error: selectError } = await supabase
      .from('player_modules')
      .select('id, module_id, rarity, slot, equipped_on')
      .eq('user_id', userId);
    if (selectError) {
      setError(selectError.message);
      setLoading(false);
      return;
    }
    setModules(
      (data ?? []).map((row) => ({
        id: row.id,
        moduleId: row.module_id,
        rarity: row.rarity as ModuleRarity,
        slot: row.slot as ModuleSlot,
        equippedOn: row.equipped_on,
      })),
    );
    setError(null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const equip = useCallback(
    async (moduleRowId: string, characterId: string | null) => {
      // Optimistic, mirroring the server's own "one per slot" rule so the card doesn't flicker
      // through a wrong state while the request is in flight.
      setModules((prev) => {
        const moving = prev.find((m) => m.id === moduleRowId);
        if (!moving) return prev;
        return prev.map((m) => {
          if (m.id === moduleRowId) return { ...m, equippedOn: characterId };
          if (characterId && m.equippedOn === characterId && m.slot === moving.slot) return { ...m, equippedOn: null };
          return m;
        });
      });
      try {
        await postApi('/api/modules/equip', { moduleRowId, characterId });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível equipar o módulo.');
        // The optimistic guess was wrong about something — take the server's word for it.
        await load();
      }
    },
    [load],
  );

  return { modules, loading, error, equip, refresh: load };
}
