-- Pantheon Idle: close a write hole on character_ability_progress.
--
-- Migration 0015 created this table with open insert/update RLS policies
-- (auth.uid() = user_id, no further restriction) back when the client wrote
-- its own ability/passive levels directly. 0021/0022 later revoked that same
-- shape of access on player_progress/player_characters/character_fragments
-- once PvE became server-authoritative, but this table was missed — every
-- write already goes through app/api/characters/** with the service-role
-- key (ability, upgrade-version, selected-ability), so nothing legitimate
-- still needs the open policy. src/hooks/useCharacterProgression.ts only
-- ever reads this table from the browser.
--
-- Left open, any logged-in player could write their own row directly from
-- the browser's session-authenticated client: max every ability/bench/
-- passive level, and (since bench_level shipped in 0025 with no bounding
-- check at all) push it arbitrarily high, for free — bypassing every credit
-- and fragment cost app/api/characters/** enforces, and feeding straight
-- into both PvE (lib/battle-resolve.ts) and PvP (pvp-attack), which trust
-- these columns verbatim.
drop policy if exists "Users can insert their own ability progress" on public.character_ability_progress;
drop policy if exists "Users can update their own ability progress" on public.character_ability_progress;
revoke insert, update on public.character_ability_progress from authenticated;
grant all on public.character_ability_progress to service_role;

-- bench_level (0025) never got a range check, unlike ability_level's
-- (1 and 5) sibling. Clamp any value written before this ships, then add
-- the same bound.
update public.character_ability_progress set bench_level = 5 where bench_level > 5;
update public.character_ability_progress set bench_level = 1 where bench_level < 1;

alter table public.character_ability_progress
  drop constraint if exists character_ability_progress_bench_level_check;
alter table public.character_ability_progress
  add constraint character_ability_progress_bench_level_check check (bench_level between 1 and 5);
