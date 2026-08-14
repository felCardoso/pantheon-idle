-- Pantheon Idle: player usernames.
-- Run this once in the Supabase SQL Editor, after migration 0003.
-- Usernames identify players to each other (chat, PvP, guild — see docs/gdd.md),
-- so the email address is never shown in the UI; this is the public handle instead.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness ("Felipe" and "felipe" can't both exist).
create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));

alter table public.profiles enable row level security;

-- Any signed-in player can look up any other player's username (not just their
-- own) — that's the point of it existing (contact/identification), unlike
-- every other table here which is select-scoped to auth.uid() = user_id.
create policy "Any authenticated player can view usernames"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Players can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

-- The client can't insert into profiles at signup time when email confirmation
-- is required (no session exists yet, so auth.uid() is null and RLS blocks it).
-- A trigger on auth.users sidesteps that entirely: it runs with elevated
-- privileges and fires the instant the account row is created, regardless of
-- confirmation state. The username itself travels in via signUp's
-- `options.data.username` (Supabase copies that into raw_user_meta_data).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Note: accounts created before this migration have no profiles row and will
-- show a fallback name in the UI until re-registered — there's no in-app
-- "set username" flow yet for retroactively backfilling existing accounts.
