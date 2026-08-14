-- Pantheon Idle: async PvP — docs/gdd.md section 6 ("o jogador ataca o time
-- de defesa salvo por outro jogador, simulado pelo servidor").
-- Run this once in the Supabase SQL Editor, after migration 0010.

-- A player's saved defense squad — what an attacker actually fights. Stored
-- as a snapshot ({characterId, xp}[] in `characters`) rather than a live
-- reference to player_characters, so an attacker always fights the roster
-- the defender chose to show, not whatever they happen to own right now.
create table if not exists public.pvp_defense_teams (
  user_id uuid primary key references auth.users (id) on delete cascade,
  characters jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.pvp_defense_teams enable row level security;

create policy "Anyone signed in can see any defense team (needed to attack it)"
  on public.pvp_defense_teams for select
  using (auth.uid() is not null);

create policy "Players can set their own defense team"
  on public.pvp_defense_teams for insert
  with check (auth.uid() = user_id);

create policy "Players can update their own defense team"
  on public.pvp_defense_teams for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- One row per resolved attack. The attacker's client runs the battle
-- (same deterministic engine as PvE) and writes the result — the defender
-- never needs to be online.
create table if not exists public.pvp_battles (
  id uuid primary key default gen_random_uuid(),
  attacker_id uuid not null references auth.users (id) on delete cascade,
  defender_id uuid not null references auth.users (id) on delete cascade,
  winner text not null check (winner in ('attacker', 'defender')),
  log jsonb,
  created_at timestamptz not null default now()
);

alter table public.pvp_battles enable row level security;

create policy "Players can see PvP battles they took part in"
  on public.pvp_battles for select
  using (auth.uid() = attacker_id or auth.uid() = defender_id);

create policy "Attackers can record a battle they just resolved"
  on public.pvp_battles for insert
  with check (auth.uid() = attacker_id);

-- Simple persistent rating (no seasons/leagues yet — docs mark those as a
-- later phase) plus a running win/loss record for the profile stat cards.
alter table public.player_progress add column if not exists pvp_rating integer not null default 1000;
alter table public.player_progress add column if not exists pvp_wins integer not null default 0;
alter table public.player_progress add column if not exists pvp_losses integer not null default 0;

-- RLS's per-row "auth.uid() = user_id" update policy means the attacker's
-- own client can update their own player_progress row, but never the
-- defender's (rightly — a client shouldn't be able to write arbitrary rows
-- for other users). Resolving an attack needs to touch both sides in one
-- atomic step, so this runs as a `security definer` function instead:
-- narrowly scoped to exactly "insert one battle row + adjust rating/wins/
-- losses on the two specific accounts involved", with the attacker always
-- taken from auth.uid() server-side (never trusted from the caller).
create or replace function public.resolve_pvp_attack(
  p_defender_id uuid,
  p_winner text,
  p_log jsonb,
  p_attacker_rating_delta integer,
  p_defender_rating_delta integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attacker_id uuid := auth.uid();
begin
  if v_attacker_id is null then
    raise exception 'not authenticated';
  end if;
  if p_winner not in ('attacker', 'defender') then
    raise exception 'invalid winner: %', p_winner;
  end if;

  insert into public.pvp_battles (attacker_id, defender_id, winner, log)
  values (v_attacker_id, p_defender_id, p_winner, p_log);

  update public.player_progress
  set pvp_rating = greatest(0, pvp_rating + p_attacker_rating_delta),
      pvp_wins = pvp_wins + case when p_winner = 'attacker' then 1 else 0 end,
      pvp_losses = pvp_losses + case when p_winner = 'defender' then 1 else 0 end
  where user_id = v_attacker_id;

  update public.player_progress
  set pvp_rating = greatest(0, pvp_rating + p_defender_rating_delta),
      pvp_wins = pvp_wins + case when p_winner = 'defender' then 1 else 0 end,
      pvp_losses = pvp_losses + case when p_winner = 'attacker' then 1 else 0 end
  where user_id = p_defender_id;
end;
$$;

grant execute on function public.resolve_pvp_attack(uuid, text, jsonb, integer, integer) to authenticated;
