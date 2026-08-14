import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

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

/**
 * Root Access (VIP) — docs/monetizacao-guilda.md section 1. No real payment
 * processor is wired up yet, so the only purchase path today is spending
 * Tokens here — a placeholder for the "cobrada em dinheiro real" recurring
 * billing the docs describe. `VIP_CREDIT_XP_BONUS_PERCENT` is applied to
 * battle rewards in useBattleSimulation.ts.
 */
export const VIP_COST_TOKENS = 500;
export const VIP_DURATION_DAYS = 30;
export const VIP_CREDIT_XP_BONUS_PERCENT = 0.15;
export const VIP_DAILY_BONUS_TOKENS = 50;

/** The Cluster's own passive bonus (docs section 2) — separate constant since it stacks with, not replaces, Root Access's. */
export const CLUSTER_CREDIT_XP_BONUS_PERCENT = 0.25;

/**
 * Team-slot loadouts ("`.cfg`", docs/gdd.md line 92): 2 slots free, +3
 * purchasable for TEAM_SLOT_COST_TOKENS each, or all 5 while Root Access is
 * active (see effectiveUnlockedTeamSlots in usePlayerTeams.ts's caller —
 * VIP access must lapse the instant VIP does, so it's never persisted here).
 */
export const TEAM_SLOT_COST_TOKENS = 250;
export const MIN_TEAM_SLOTS = 2;
export const MAX_TEAM_SLOTS = 5;

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
  /** Marks the starter boost as claimed — the caller is responsible for actually granting the credits (see useBattleSimulation's adjustCredits). */
  claimStarterBoost: () => Promise<void>;
  /** Deducts tokens if affordable, persists, and returns whether it succeeded. */
  spendTokens: (amount: number) => Promise<boolean>;
  /** Adjusts the Bytes balance by delta (positive or negative), persists, and returns whether it succeeded (fails only if a negative delta would go below 0). */
  adjustBytes: (delta: number) => Promise<boolean>;
  setTeamVisibility: (value: TeamVisibility) => Promise<void>;
  /** Spends VIP_COST_TOKENS for VIP_DURATION_DAYS of Root Access, stacking onto any remaining time if already active. Returns whether it succeeded (fails if tokens are short). */
  purchaseVip: () => Promise<boolean>;
  /** Grants VIP_DAILY_BONUS_TOKENS once per UTC calendar day while Root Access is active. Returns whether it actually granted anything. */
  claimDailyVipBonus: () => Promise<boolean>;
  /** Spends TEAM_SLOT_COST_TOKENS to permanently unlock the next team slot (up to MAX_TEAM_SLOTS). Returns whether it succeeded. */
  purchaseTeamSlot: () => Promise<boolean>;
  setPveTeamSlot: (slot: number) => Promise<void>;
  setPvpTeamSlot: (slot: number) => Promise<void>;
}

function isVipActive(vipExpiresAt: string | null): boolean {
  return !!vipExpiresAt && new Date(vipExpiresAt).getTime() > Date.now();
}

function isSameUtcDay(a: string, b: Date): boolean {
  const d = new Date(a);
  return d.getUTCFullYear() === b.getUTCFullYear() && d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() === b.getUTCDate();
}

/** Loads (creating on first login) and persists a player's world position + wallet in `player_progress`. */
export function usePlayerProgress(userId: string | undefined): UsePlayerProgressResult {
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [starterBoostClaimed, setStarterBoostClaimed] = useState(false);
  const [tokens, setTokens] = useState(0);
  const [teamVisibility, setTeamVisibilityState] = useState<TeamVisibility>(DEFAULT_TEAM_VISIBILITY);
  const [vipExpiresAt, setVipExpiresAt] = useState<string | null>(null);
  const [vipDailyBonusClaimedAt, setVipDailyBonusClaimedAt] = useState<string | null>(null);
  const [bandwidth, setBandwidth] = useState(0);
  const [bytes, setBytes] = useState(0);
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
      setVipDailyBonusClaimedAt(null);
      setBandwidth(0);
      setBytes(0);
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
          'fase, estagio, credits, xp, starter_boost_claimed, tokens, team_visibility, vip_expires_at, vip_daily_bonus_claimed_at, bandwidth, unlocked_team_slots, pve_team_slot, pvp_team_slot, bytes',
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
        setVipDailyBonusClaimedAt(null);
        setBandwidth(0);
        setBytes(0);
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
        setVipDailyBonusClaimedAt(data.vip_daily_bonus_claimed_at);
        setBandwidth(data.bandwidth);
        setBytes(data.bytes);
        setUnlockedTeamSlots(data.unlocked_team_slots);
        setPveTeamSlotState(data.pve_team_slot);
        setPvpTeamSlotState(data.pvp_team_slot);
      } else {
        const { error: insertError } = await supabase
          .from('player_progress')
          .insert({ user_id: userId, ...DEFAULT_PROGRESS });
        if (!cancelled && insertError) setError(insertError.message);
        if (!cancelled) {
          setProgress(DEFAULT_PROGRESS);
          setStarterBoostClaimed(false);
          setTokens(DEFAULT_TOKENS);
          setTeamVisibilityState(DEFAULT_TEAM_VISIBILITY);
          setVipExpiresAt(null);
          setVipDailyBonusClaimedAt(null);
          setBandwidth(0);
          setBytes(0);
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

  const saveProgress = useCallback(
    async (next: PlayerProgress) => {
      if (!userId) return;
      setProgress(next);
      const { error: upsertError } = await supabase.from('player_progress').upsert({ user_id: userId, ...next }, { onConflict: 'user_id' });
      setError(upsertError ? upsertError.message : null);
    },
    [userId],
  );

  const claimStarterBoost = useCallback(async () => {
    if (!userId || starterBoostClaimed) return;
    setStarterBoostClaimed(true);
    const { error: updateError } = await supabase.from('player_progress').update({ starter_boost_claimed: true }).eq('user_id', userId);
    setError(updateError ? updateError.message : null);
  }, [userId, starterBoostClaimed]);

  const spendTokens = useCallback(
    async (amount: number): Promise<boolean> => {
      if (!userId || amount <= 0 || tokens < amount) return false;
      const next = tokens - amount;
      setTokens(next);
      const { error: updateError } = await supabase.from('player_progress').update({ tokens: next }).eq('user_id', userId);
      setError(updateError ? updateError.message : null);
      return true;
    },
    [userId, tokens],
  );

  const adjustBytes = useCallback(
    async (delta: number): Promise<boolean> => {
      if (!userId || bytes + delta < 0) return false;
      const next = bytes + delta;
      setBytes(next);
      const { error: updateError } = await supabase.from('player_progress').update({ bytes: next }).eq('user_id', userId);
      setError(updateError ? updateError.message : null);
      return true;
    },
    [userId, bytes],
  );

  const setTeamVisibility = useCallback(
    async (value: TeamVisibility) => {
      if (!userId) return;
      setTeamVisibilityState(value);
      const { error: updateError } = await supabase.from('player_progress').update({ team_visibility: value }).eq('user_id', userId);
      setError(updateError ? updateError.message : null);
    },
    [userId],
  );

  const purchaseVip = useCallback(async (): Promise<boolean> => {
    if (!userId || tokens < VIP_COST_TOKENS) return false;
    const nextTokens = tokens - VIP_COST_TOKENS;
    // Stacks onto remaining time if already active, rather than resetting the clock.
    const base = isVipActive(vipExpiresAt) ? new Date(vipExpiresAt as string) : new Date();
    const nextExpiresAt = new Date(base.getTime() + VIP_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    setTokens(nextTokens);
    setVipExpiresAt(nextExpiresAt);
    const { error: updateError } = await supabase
      .from('player_progress')
      .update({ tokens: nextTokens, vip_expires_at: nextExpiresAt })
      .eq('user_id', userId);
    setError(updateError ? updateError.message : null);
    return true;
  }, [userId, tokens, vipExpiresAt]);

  const claimDailyVipBonus = useCallback(async (): Promise<boolean> => {
    if (!userId || !isVipActive(vipExpiresAt)) return false;
    const now = new Date();
    if (vipDailyBonusClaimedAt && isSameUtcDay(vipDailyBonusClaimedAt, now)) return false;
    const nextTokens = tokens + VIP_DAILY_BONUS_TOKENS;
    const nowIso = now.toISOString();
    setTokens(nextTokens);
    setVipDailyBonusClaimedAt(nowIso);
    const { error: updateError } = await supabase
      .from('player_progress')
      .update({ tokens: nextTokens, vip_daily_bonus_claimed_at: nowIso })
      .eq('user_id', userId);
    setError(updateError ? updateError.message : null);
    return true;
  }, [userId, tokens, vipExpiresAt, vipDailyBonusClaimedAt]);

  const purchaseTeamSlot = useCallback(async (): Promise<boolean> => {
    if (!userId || unlockedTeamSlots >= MAX_TEAM_SLOTS || tokens < TEAM_SLOT_COST_TOKENS) return false;
    const nextTokens = tokens - TEAM_SLOT_COST_TOKENS;
    const nextSlots = unlockedTeamSlots + 1;
    setTokens(nextTokens);
    setUnlockedTeamSlots(nextSlots);
    const { error: updateError } = await supabase
      .from('player_progress')
      .update({ tokens: nextTokens, unlocked_team_slots: nextSlots })
      .eq('user_id', userId);
    setError(updateError ? updateError.message : null);
    return true;
  }, [userId, tokens, unlockedTeamSlots]);

  const setPveTeamSlot = useCallback(
    async (slot: number) => {
      if (!userId) return;
      setPveTeamSlotState(slot);
      const { error: updateError } = await supabase.from('player_progress').update({ pve_team_slot: slot }).eq('user_id', userId);
      setError(updateError ? updateError.message : null);
    },
    [userId],
  );

  const setPvpTeamSlot = useCallback(
    async (slot: number) => {
      if (!userId) return;
      setPvpTeamSlotState(slot);
      const { error: updateError } = await supabase.from('player_progress').update({ pvp_team_slot: slot }).eq('user_id', userId);
      setError(updateError ? updateError.message : null);
    },
    [userId],
  );

  return {
    progress,
    starterBoostClaimed,
    tokens,
    teamVisibility,
    vipActive: isVipActive(vipExpiresAt),
    vipExpiresAt,
    bandwidth,
    bytes,
    unlockedTeamSlots,
    pveTeamSlot,
    pvpTeamSlot,
    loading,
    error,
    saveProgress,
    claimStarterBoost,
    spendTokens,
    adjustBytes,
    setTeamVisibility,
    purchaseVip,
    claimDailyVipBonus,
    purchaseTeamSlot,
    setPveTeamSlot,
    setPvpTeamSlot,
  };
}
