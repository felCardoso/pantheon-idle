-- Pantheon Idle: Módulos (`.dll` runes) and the character version track.
--
-- Both are written only by app/api/** with the service-role key, following the
-- rule migration 0022 established: the client never writes anything that
-- decides combat power.

-- ---------------------------------------------------------------------------
-- Character version (v1.0 -> v2.0), stored as tenths so the whole track is
-- integer comparison: 10 = v1.0, 15 = v1.5, 20 = v2.0.
--
-- Deliberately on player_characters' sibling table rather than per (character,
-- rarity): pulling the same character again at a higher rarity must not reset
-- the fragments already spent evolving it. Version gates the passive; rarity
-- gates ability levels. They are separate axes on purpose.
alter table public.character_ability_progress
  add column if not exists character_version integer not null default 10
  check (character_version between 10 and 20);

-- The bench ability gets its own level. It shared `ability_level` with the
-- active kit, so upgrading one silently upgraded the other — and the Upgrades
-- screen now offers them as separate purchases.
alter table public.character_ability_progress
  add column if not exists bench_level integer not null default 1;

-- ---------------------------------------------------------------------------
-- A player's owned runes. One row per copy: the same rune id can be held
-- several times at different grades, and each copy is equipped independently.
create table if not exists public.player_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Matches an id in src/data/modules.ts's MODULE_DEFINITIONS.
  module_id text not null,
  rarity text not null check (rarity in ('S', 'A', 'B', 'C')),
  -- Which character is wearing it, or null while it sits in the inventory. A
  -- character wears at most one rune per slot; that is enforced by the unique
  -- index below rather than by trusting the writer.
  equipped_on text,
  slot text not null check (slot in ('ultimate', 'attack', 'defense', 'support')),
  acquired_at timestamptz not null default now()
);

create index if not exists player_modules_user_idx on public.player_modules (user_id);

-- One rune per slot per character. Partial, so unequipped copies (equipped_on
-- null) don't collide with each other.
create unique index if not exists player_modules_one_per_slot
  on public.player_modules (user_id, equipped_on, slot)
  where equipped_on is not null;

alter table public.player_modules enable row level security;

-- Read-only for the owner. Every write (acquire, equip, unequip) goes through
-- app/api/modules/**, which uses the service-role key — a client that could
-- insert its own rows could hand itself a full set of S runes.
create policy "Players can view their own modules"
  on public.player_modules for select
  using (auth.uid() = user_id);

grant all on public.player_modules to service_role;
