-- Pantheon Idle: hard currency (tokens) + team-visibility privacy preference.
-- Run this once in the Supabase SQL Editor, after migration 0006.

-- Tokens are the hard currency (docs/gdd.md section 9) — real and persisted
-- from here on, spent on things like changing nicknames (250 tokens). There's
-- no earn path yet (achievements/events/purchases, per the docs, aren't built)
-- — this is a first-pass starting balance, not a full economy.
alter table public.player_progress add column if not exists tokens integer not null default 300;

-- Which team shows on the (future) public-facing profile: the real PvE
-- roster, a PvP defense squad (not a real separate concept yet — the profile
-- UI shows an honest "em breve" note for this option), or hidden entirely.
alter table public.player_progress add column if not exists team_visibility text not null default 'pve';
alter table public.player_progress drop constraint if exists player_progress_team_visibility_check;
alter table public.player_progress add constraint player_progress_team_visibility_check
  check (team_visibility in ('pve', 'pvp', 'hidden'));
