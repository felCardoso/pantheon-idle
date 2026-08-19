-- Pantheon Idle: random PvP encounters during the PvE grind.
--
-- After a few PvE battles a run can roll into a live PvP match against another
-- player's saved defense team, instead of PvP only ever happening when someone
-- opens the opponent list and clicks Atacar.
--
-- The counter lives here rather than in React state for the same reason
-- recovery_wins_remaining does (migration 0022): app/api/battle/resolve rolls
-- the encounter, and a client that reported its own counter could either farm
-- encounters or never trigger one.

alter table public.player_progress
  add column if not exists pve_battles_since_pvp integer not null default 0;
