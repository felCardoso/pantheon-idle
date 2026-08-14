-- Pantheon Idle: profile avatar selection + nickname changes.
-- Run this once in the Supabase SQL Editor, after migration 0007.

-- Which owned character's portrait to show as the profile avatar. Nullable —
-- null means "no avatar chosen yet, show the generic placeholder icon".
alter table public.profiles add column if not exists avatar_character_id text;

-- Migration 0004 only allowed select/insert (the username was permanent,
-- set once at signup). Nickname changes and avatar selection both need to
-- update an existing row now.
drop policy if exists "Players can update their own profile" on public.profiles;
create policy "Players can update their own profile"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
