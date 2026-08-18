import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { postApi } from '../lib/apiClient';
import {
  VIP_COST_TOKENS,
  VIP_DURATION_DAYS,
  VIP_CREDIT_XP_BONUS_PERCENT,
  VIP_DAILY_BONUS_TOKENS,
  CLUSTER_CREDIT_XP_BONUS_PERCENT,
  BANNER_PITY_MAX,
  TEAM_SLOT_COST_TOKENS,
  MIN_TEAM_SLOTS,
  MAX_TEAM_SLOTS,
} from '../data/playerEconomy';

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

// Re-exported for existing call sites (ShopPage.tsx, GachaPage.tsx) — the values themselves
// now live in src/data/playerEconomy.ts so app/api/player/** and app/api/gacha/** routes can
// import them too without pulling in this hook's browser-only supabase client.
export {
  VIP_COST_TOKENS,
  VIP_DURATION_DAYS,
  VIP_CREDIT_XP_BONUS_PERCENT,
  VIP_DAILY_BONUS_TOKENS,
  CLUSTER_CREDIT_XP_BONUS_PERCENT,
  BANNER_PITY_MAX,
  TEAM_SLOT_COST_TOKENS,
  MIN_TEAM_SLOTS,
  MAX_TEAM_SLOTS,
};

export interface UsePlayerProgressResult {
  /** null while loading; falls back to DEFAULT_PROGRESS if the row/table isn't there yet. */
  progress: PlayerProgress | null;
  /** Whether the one-time starter credit boost (Loja) has already been claimed. Kept separate from `progress`/`saveProgress` — it's a one-off action, not part of the fase/estagio/wallet sync loop. */
  starterBoostClaimed: boolean;
  /** The hard-currency balance (docs/gdd.md section 9) — real and persisted, spent on things like nickname changes. Kept separate from `progress`/`saveProgress` for the same reason as starterBoostClaimed: it only ever changes via explicit spend actions, never the battle-sync loop. */
  tokens: number;
  /** Which team shows on the (future) public profile. */
  teamVisibility: TeamVisibility;
  /** True whenever vipExpiresAt is set and in the future — the single source of truth for "is Root Access active." */
  vipActive: boolean;
  vipExpiresAt: string | null;
  /** Cluster-only currency (docs section 2) — no earn path yet (the DDoS Raid that grants it isn't built), so this stays at 0 until then. */
  bandwidth: number;
  /** Tech-flavored currency earned by converting duplicate-character fragments in Mercado's "Meu Inventário" tab. */
  bytes: number;
  /** Persisted team-slot purchases (2-5) — the effective unlocked count is `vipActive ? MAX_TEAM_SLOTS : unlockedTeamSlots`. */
  unlockedTeamSlots: number;
  /** Which of the 5 saved teams (see usePlayerTeams.ts) currently feeds PvE battles / PvP defense. */
  pveTeamSlot: number;
  pvpTeamSlot: number;
  loading: boolean;
  /** Non-null if the last load/save hit an error (e.g. the migration hasn't been run yet) — play continues, just unsaved. */
  error: string | null;
  saveProgress: (next: PlayerProgress) => Promise<void>;
  /** Claims the one-time starter credit boost via /api/player/claim-starter-boost, which grants
   * the credits itself — returns the new credits total (for the caller's battle.setWallet) or
   * null if it failed/was already claimed. */
  claimStarterBoost: () => Promise<number | null>;
  /** Deducts tokens if affordable via /api/player/spend-tokens, and returns whether it succeeded. */
  spendTokens: (amount: number) => Promise<boolean>;
  /** Banner Semanal hard pity counter — 1 per banner pull. Written server-side only (see
   * app/api/gacha/roll and app/api/gacha/claim-pity); syncFromGachaResponse mirrors it here. */
  bannerPity: number;
  /** The banner's "50/50" carry-over — true once the player has lost a 50/50 and the next Zero-Day pulled on the banner is guaranteed to be the spotlighted character. Same server-only write rule as bannerPity. */
  bannerGuaranteed: boolean;
  setTeamVisibility: (value: TeamVisibility) => Promise<void>;
  /** Spends VIP_COST_TOKENS for VIP_DURATION_DAYS of Root Access, stacking onto any remaining time if already active. Returns whether it succeeded (fails if tokens are short). */
  purchaseVip: () => Promise<boolean>;
  /** Grants VIP_DAILY_BONUS_TOKENS once per UTC calendar day while Root Access is active. Returns whether it actually granted anything. */
  claimDailyVipBonus: () => Promise<boolean>;
  /** Spends TEAM_SLOT_COST_TOKENS to permanently unlock the next team slot (up to MAX_TEAM_SLOTS). Returns whether it succeeded. */
  purchaseTeamSlot: () => Promise<boolean>;
  setPveTeamSlot: (slot: number) => Promise<void>;
  setPvpTeamSlot: (slot: number) => Promise<void>;
  /**
   * Overwrites tokens/bannerPity/bannerGuaranteed with server-authoritative values from an
   * /api/gacha/** response, without writing to Supabase — the API route already persisted
   * them, this just syncs local UI state to match. See src/lib/apiClient.ts's callers.
   */
  syncFromGachaResponse: (next: { tokens: number; bannerPity: number; bannerGuaranteed: boolean }) => void;
  /** Same idea as syncFromGachaResponse, for /api/characters/sell-fragment's byte grant — see
   * useOwnedCharacters.ts's sellFragment. */
  setBytesFromServer: (bytes: number) => void;
}

function isVipActive(vipExpiresAt: string | null): boolean {
  return !!vipExpiresAt && new Date(vipExpiresAt).getTime() > Date.now();
}

/** Loads (creating on first login) and persists a player's world position + wallet in `player_progress`. */
export function usePlayerProgress(userId: string | undefined): UsePlayerProgressResult {
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [starterBoostClaimed, setStarterBoostClaimed] = useState(false);
  const [tokens, setTokens] = useState(0);
  const [teamVisibility, setTeamVisibilityState] = useState<TeamVisibility>(DEFAULT_TEAM_VISIBILITY);
  const [vipExpiresAt, setVipExpiresAt] = useState<string | null>(null);
  const [bandwidth, setBandwidth] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [bannerPity, setBannerPity] = useState(0);
  const [bannerGuaranteed, setBannerGuaranteedState] = useState(false);
  const [unlockedTeamSlots, setUnlockedTeamSlots] = useState(MIN_TEAM_SLOTS);
  const [pveTeamSlot, setPveTeamSlotState] = useState(1);
  const [pvpTeamSlot, setPvpTeamSlotState] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setProgress(null);
      setStarterBoostClaimed(false);
      setTokens(0);
      setTeamVisibilityState(DEFAULT_TEAM_VISIBILITY);
      setVipExpiresAt(null);
      setBandwidth(0);
      setBytes(0);
      setBannerPity(0);
      setBannerGuaranteedState(false);
      setUnlockedTeamSlots(MIN_TEAM_SLOTS);
      setPveTeamSlotState(1);
      setPvpTeamSlotState(1);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error: selectError } = await supabase
        .from('player_progress')
        .select(
          'fase, estagio, credits, xp, starter_boost_claimed, tokens, team_visibility, vip_expires_at, bandwidth, unlocked_team_slots, pve_team_slot, pvp_team_slot, bytes, banner_pity, banner_guaranteed',
        )
        .eq('user_id', userId)
        .maybeSingle();

      if (cancelled) return;

      if (selectError) {
        setError(selectError.message);
        setProgress(DEFAULT_PROGRESS);
        setStarterBoostClaimed(false);
        setTokens(DEFAULT_TOKENS);
        setTeamVisibilityState(DEFAULT_TEAM_VISIBILITY);
        setVipExpiresAt(null);
        setBandwidth(0);
        setBytes(0);
        setBannerPity(0);
        setBannerGuaranteedState(false);
        setUnlockedTeamSlots(MIN_TEAM_SLOTS);
        setPveTeamSlotState(1);
        setPvpTeamSlotState(1);
        setLoading(false);
        return;
      }

      if (data) {
        setProgress({ fase: data.fase, estagio: data.estagio, credits: data.credits, xp: data.xp });
        setStarterBoostClaimed(data.starter_boost_claimed);
        setTokens(data.tokens);
        setTeamVisibilityState((data.team_visibility as TeamVisibility) ?? DEFAULT_TEAM_VISIBILITY);
        setVipExpiresAt(data.vip_expires_at);
        setBandwidth(data.bandwidth);
        setBytes(data.bytes);
        setBannerPity(data.banner_pity);
        setBannerGuaranteedState(data.banner_guaranteed);
        setUnlockedTeamSlots(data.unlocked_team_slots);
        setPveTeamSlotState(data.pve_team_slot);
        setPvpTeamSlotState(data.pvp_team_slot);
      } else {
        // First login: an empty, hardcoded-default row the RLS policy already restricts to
        // auth.uid() = user_id — nothing attacker-controlled here, unlike every other write
        // in this hook, so it's fine to leave as a direct client insert.
        const { error: insertError } = await supabase.from('player_progress').insert({ user_id: userId, ...DEFAULT_PROGRESS });
        if (!cancelled && insertError) setError(insertError.message);
        if (!cancelled) {
          setProgress(DEFAULT_PROGRESS);
          setStarterBoostClaimed(false);
          setTokens(DEFAULT_TOKENS);
          setTeamVisibilityState(DEFAULT_TEAM_VISIBILITY);
          setVipExpiresAt(null);
          setBandwidth(0);
          setBytes(0);
          setBannerPity(0);
          setBannerGuaranteedState(false);
          setUnlockedTeamSlots(MIN_TEAM_SLOTS);
          setPveTeamSlotState(1);
          setPvpTeamSlotState(1);
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Battle-driven (fase/estagio/credits/xp from useBattleSimulation) — not migrated yet, since
  // that means moving battle resolution itself server-side, a much larger change than the rest
  // of this pass. See the conversation notes on this hook's callers.
  const saveProgress = useCallback(
    async (next: PlayerProgress) => {
      if (!userId) return;
      setProgress(next);
      const { error: upsertError } = await supabase.from('player_progress').upsert({ user_id: userId, ...next }, { onConflict: 'user_id' });
      setError(upsertError ? upsertError.message : null);
    },
    [userId],
  );

  const claimStarterBoost = useCallback(async (): Promise<number | null> => {
    if (!userId || starterBoostClaimed) return null;
    try {
      const response = await postApi<{ credits: number }>('/api/player/claim-starter-boost');
      setStarterBoostClaimed(true);
      setError(null);
      return response.credits;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim starter boost');
      return null;
    }
  }, [userId, starterBoostClaimed]);

  const spendTokens = useCallback(
    async (amount: number): Promise<boolean> => {
      if (!userId || amount <= 0 || tokens < amount) return false;
      try {
        const response = await postApi<{ tokens: number }>('/api/player/spend-tokens', { amount });
        setTokens(response.tokens);
        setError(null);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to spend tokens');
        return false;
      }
    },
    [userId, tokens],
  );

  const setTeamVisibility = useCallback(
    async (value: TeamVisibility) => {
      if (!userId) return;
      setTeamVisibilityState(value);
      try {
        await postApi('/api/player/set-team-visibility', { value });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to set team visibility');
      }
    },
    [userId],
  );

  const purchaseVip = useCallback(async (): Promise<boolean> => {
    if (!userId || tokens < VIP_COST_TOKENS) return false;
    try {
      const response = await postApi<{ tokens: number; vipExpiresAt: string }>('/api/player/purchase-vip');
      setTokens(response.tokens);
      setVipExpiresAt(response.vipExpiresAt);
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to purchase VIP');
      return false;
    }
  }, [userId, tokens]);

  const claimDailyVipBonus = useCallback(async (): Promise<boolean> => {
    if (!userId || !isVipActive(vipExpiresAt)) return false;
    try {
      const response = await postApi<{ tokens: number }>('/api/player/claim-daily-vip-bonus');
      setTokens(response.tokens);
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim daily bonus');
      return false;
    }
  }, [userId, vipExpiresAt]);

  const purchaseTeamSlot = useCallback(async (): Promise<boolean> => {
    if (!userId || unlockedTeamSlots >= MAX_TEAM_SLOTS || tokens < TEAM_SLOT_COST_TOKENS) return false;
    try {
      const response = await postApi<{ tokens: number; unlockedTeamSlots: number }>('/api/player/purchase-team-slot');
      setTokens(response.tokens);
      setUnlockedTeamSlots(response.unlockedTeamSlots);
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to purchase team slot');
      return false;
    }
  }, [userId, tokens, unlockedTeamSlots]);

  const setPveTeamSlot = useCallback(
    async (slot: number) => {
      if (!userId) return;
      setPveTeamSlotState(slot);
      try {
        await postApi('/api/player/set-team-slot', { type: 'pve', slot });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to set PvE team slot');
      }
    },
    [userId],
  );

  const setPvpTeamSlot = useCallback(
    async (slot: number) => {
      if (!userId) return;
      setPvpTeamSlotState(slot);
      try {
        await postApi('/api/player/set-team-slot', { type: 'pvp', slot });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to set PvP team slot');
      }
    },
    [userId],
  );

  const syncFromGachaResponse = useCallback((next: { tokens: number; bannerPity: number; bannerGuaranteed: boolean }) => {
    setTokens(next.tokens);
    setBannerPity(next.bannerPity);
    setBannerGuaranteedState(next.bannerGuaranteed);
  }, []);

  const setBytesFromServer = useCallback((next: number) => {
    setBytes(next);
  }, []);

  return {
    progress,
    starterBoostClaimed,
    tokens,
    teamVisibility,
    vipActive: isVipActive(vipExpiresAt),
    vipExpiresAt,
    bandwidth,
    bytes,
    bannerPity,
    bannerGuaranteed,
    unlockedTeamSlots,
    pveTeamSlot,
    pvpTeamSlot,
    loading,
    error,
    saveProgress,
    claimStarterBoost,
    spendTokens,
    setTeamVisibility,
    purchaseVip,
    claimDailyVipBonus,
    purchaseTeamSlot,
    setPveTeamSlot,
    setPvpTeamSlot,
    syncFromGachaResponse,
    setBytesFromServer,
  };
}
