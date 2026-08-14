-- Pantheon Idle: "Root Access" (VIP subscription) — docs/monetizacao-guilda.md section 1.
-- Run this once in the Supabase SQL Editor, after migration 0008.

-- Root Access is active whenever vip_expires_at is set and in the future —
-- no separate boolean needed, expiry alone is the source of truth (avoids
-- the two fields ever disagreeing). There's no real payment processor wired
-- up yet, so today the only way to set this is spending Tokens in the Loja
-- (see usePlayerProgress.ts's purchaseVip) — a placeholder for real
-- recurring billing, not the "cobrada em dinheiro real" the docs describe.
alter table public.player_progress add column if not exists vip_expires_at timestamptz;

-- Last time the daily Root Access token bonus was claimed — null means
-- never claimed. Compared against "today" (UTC date) to gate one claim/day.
alter table public.player_progress add column if not exists vip_daily_bonus_claimed_at timestamptz;
