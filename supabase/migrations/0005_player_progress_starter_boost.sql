-- Pantheon Idle: starter credit boost — a one-time bonus claimable from the Loja.
-- Run this once in the Supabase SQL Editor, after migration 0004.

alter table public.player_progress add column if not exists starter_boost_claimed boolean not null default false;
