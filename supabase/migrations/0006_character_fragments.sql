-- Pantheon Idle: character fragments ("diagramas", docs/gdd.md section 7/8 `.dat`).
-- Run this once in the Supabase SQL Editor, after migration 0005.
-- A gacha pull that rolls a character the player already owns converts into a
-- fragment of that character instead of a duplicate .exe. Fragments can be
-- sold for credits from the Loja. Trading fragments with other players isn't
-- implemented yet — no player-to-player market exists (see docs/monetizacao-guilda.md's
-- "Mercado de Diagramas", still a "soon" nav item).

create table if not exists public.character_fragments (
  user_id uuid not null references auth.users (id) on delete cascade,
  character_id text not null,
  count integer not null default 0,
  primary key (user_id, character_id)
);

alter table public.character_fragments enable row level security;

create policy "Players can view their own fragments"
  on public.character_fragments for select
  using (auth.uid() = user_id);

create policy "Players can insert their own fragments"
  on public.character_fragments for insert
  with check (auth.uid() = user_id);

create policy "Players can update their own fragments"
  on public.character_fragments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
