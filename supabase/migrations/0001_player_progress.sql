-- Pantheon Idle: player world progression + wallet persistence.
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- One row per authenticated player, keyed by auth.users.id.

create table if not exists public.player_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  fase integer not null default 1,
  estagio integer not null default 1,
  credits integer not null default 0,
  xp integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.player_progress enable row level security;

create policy "Players can view their own progress"
  on public.player_progress for select
  using (auth.uid() = user_id);

create policy "Players can insert their own progress"
  on public.player_progress for insert
  with check (auth.uid() = user_id);

create policy "Players can update their own progress"
  on public.player_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at accurate on every save without trusting the client to set it.
create or replace function public.set_player_progress_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists player_progress_set_updated_at on public.player_progress;
create trigger player_progress_set_updated_at
  before update on public.player_progress
  for each row
  execute function public.set_player_progress_updated_at();
