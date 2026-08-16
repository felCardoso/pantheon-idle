-- Pantheon Idle: Banner Semanal "50/50" carry-over flag (docs/gdd.md section 10).
-- Run this once in the Supabase SQL Editor, after migration 0015.

-- Set when a banner pull rolls Zero-Day but loses the 50/50 against the
-- spotlighted character — guarantees the *next* Zero-Day pulled on the
-- banner is the spotlighted character. Independent of the separate
-- banner_pity hard-pity counter (migration 0015).
alter table public.player_progress
  add column if not exists banner_guaranteed boolean not null default false;
