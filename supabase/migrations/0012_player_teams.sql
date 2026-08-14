-- Pantheon Idle: team-slot loadouts ("`.cfg`", docs/gdd.md line 92 —
-- "Cada .cfg = uma formação/loadout salvo. 2 slots iniciais; +3 slots
-- compráveis na loja por preço alto; jogadores VIP têm acesso a esses 3
-- slots enquanto o VIP estiver ativo").
-- Run this once in the Supabase SQL Editor, after migration 0011.

-- One row per team slot (1-5) a player has ever named/edited. Missing rows
-- (a slot never touched yet) are filled in client-side as an empty,
-- default-named team — see src/hooks/usePlayerTeams.ts.
create table if not exists public.player_teams (
  user_id uuid not null references auth.users (id) on delete cascade,
  slot integer not null check (slot between 1 and 5),
  name text not null,
  -- Array of character ids (max 5 members per docs/combate.md's "times de
  -- até 5 personagens por lado").
  characters jsonb not null default '[]'::jsonb check (jsonb_array_length(characters) <= 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);

alter table public.player_teams enable row level security;

create policy "Players can view their own teams"
  on public.player_teams for select
  using (auth.uid() = user_id);

create policy "Players can create their own teams"
  on public.player_teams for insert
  with check (auth.uid() = user_id);

create policy "Players can update their own teams"
  on public.player_teams for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- unlocked_team_slots: persisted purchases (250 tokens each for slot 3-5,
-- per docs), 2-5. VIP's "access to the 3 extra slots while active" is
-- computed client-side (vipActive ? 5 : unlocked_team_slots), not stored,
-- since it must lapse the moment VIP does.
-- pve_team_slot / pvp_team_slot: which of the 5 saved teams currently feeds
-- PvE battles and PvP defense, respectively.
alter table public.player_progress add column if not exists unlocked_team_slots integer not null default 2;
alter table public.player_progress add column if not exists pve_team_slot integer not null default 1;
alter table public.player_progress add column if not exists pvp_team_slot integer not null default 1;
