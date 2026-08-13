-- Pantheon Idle: character ownership.
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- One row per (player, owned character). Ownership is permanent for now — no
-- update/delete policy, since there's no way to lose or trade a character yet.

create table if not exists public.player_characters (
  user_id uuid not null references auth.users (id) on delete cascade,
  character_id text not null,
  acquired_at timestamptz not null default now(),
  primary key (user_id, character_id)
);

alter table public.player_characters enable row level security;

create policy "Players can view their own characters"
  on public.player_characters for select
  using (auth.uid() = user_id);

create policy "Players can insert their own characters"
  on public.player_characters for insert
  with check (auth.uid() = user_id);
