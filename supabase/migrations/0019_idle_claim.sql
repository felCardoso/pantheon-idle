-- Pantheon Idle: offline/idle income (docs/gdd.md section 9 "Sistema offline").
-- Run this once in the Supabase SQL Editor, after migration 0018.
-- Tracks when a player last claimed their idle credits/xp so app/api/idle/claim
-- can pay out for the elapsed time since then, server-side.

alter table public.player_progress
  add column if not exists last_claim_at timestamptz not null default now();
