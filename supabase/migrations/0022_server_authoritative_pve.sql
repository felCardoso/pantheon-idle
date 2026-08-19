-- Pantheon Idle: make PvE rewards server-authoritative.
--
-- Migration 0021 narrowed the client's write on player_progress to fase, estagio,
-- credits and xp — the four the browser legitimately wrote at the time, because
-- PvE battle resolution ran there. That left the game's entire economy
-- self-reported: a player could set their own credits and XP, and since
-- player_characters.xp feeds the attacker's stats in PvP, inflated XP leaked
-- into other players' matches too.
--
-- app/api/battle/resolve now runs the fight on the server (lib/battle-resolve.ts)
-- and writes the outcome itself, so the browser no longer needs to write any of
-- it. Revoke the last of the client's write surface on both tables.

-- Tracks the retreat-recovery streak across sessions. It used to live only in
-- React state, which meant the server could not reproduce a player's progression
-- state when resolving a battle — and a client that simply reported "no recovery
-- pending" skipped the grind entirely.
alter table public.player_progress
  add column if not exists recovery_wins_remaining integer;

-- player_progress: the row is still created client-side on first load, so INSERT
-- keeps its four columns; UPDATE goes away entirely. Every later write to this
-- table now comes from app/api/** with the service-role key.
revoke update on public.player_progress from authenticated;

-- player_characters: XP is granted by battles, and battles are now resolved
-- server-side. Ownership rows are still inserted by the claim-starter/gacha
-- routes (service-role), so the client needs neither insert nor update.
drop policy if exists "Players can insert their own characters" on public.player_characters;
drop policy if exists "Players can update their own characters" on public.player_characters;
revoke insert, update on public.player_characters from authenticated;

-- Fragment counts move only through the market/gacha/sell routes, which are all
-- service-role. Same reasoning.
drop policy if exists "Players can insert their own fragments" on public.character_fragments;
drop policy if exists "Players can update their own fragments" on public.character_fragments;
revoke insert, update on public.character_fragments from authenticated;

grant all on public.player_progress to service_role;
grant all on public.player_characters to service_role;
grant all on public.character_fragments to service_role;
