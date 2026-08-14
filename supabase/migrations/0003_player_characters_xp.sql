-- Pantheon Idle: character XP/leveling.
-- Run this once in the Supabase SQL Editor, after migration 0002.
-- Level is always derived from xp client-side (see src/engine/core/leveling.ts)
-- rather than stored — only the raw accumulated xp is persisted.

alter table public.player_characters add column if not exists xp integer not null default 0;

-- migration 0002 only allowed select/insert (ownership was permanent, no updates).
-- Leveling now needs to update an owned character's xp on every battle win.
drop policy if exists "Players can update their own characters" on public.player_characters;
create policy "Players can update their own characters"
  on public.player_characters for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
