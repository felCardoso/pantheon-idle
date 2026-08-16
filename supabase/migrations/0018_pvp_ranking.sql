-- Pantheon Idle: PvP ranking (docs/gdd.md §6: "Ranking/liga por temporadas,
-- com recompensas por faixa" — no seasons/leagues yet, same scope note as
-- migration 0011's rating system itself). Named rank tiers are computed
-- client-side from pvp_rating (see src/data/pvpRank.ts) — this migration is
-- only the server-side reads a real leaderboard needs, since
-- player_progress's existing RLS ("auth.uid() = user_id", migration 0001)
-- blocks a client from reading anyone else's rating directly.
-- Run this once in the Supabase SQL Editor, after migration 0017.

-- Highest rating ever reached — separate from pvp_rating (which can drop
-- after a loss), for the profile's "Rank máximo" stat card.
alter table public.player_progress add column if not exists pvp_peak_rating integer not null default 1000;

-- resolve_pvp_attack (migration 0011) now also bumps peak rating for
-- whichever side's new rating is a new high, alongside the existing
-- rating/wins/losses update.
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
      pvp_peak_rating = greatest(pvp_peak_rating, greatest(0, pvp_rating + p_attacker_rating_delta)),
      pvp_wins = pvp_wins + case when p_winner = 'attacker' then 1 else 0 end,
      pvp_losses = pvp_losses + case when p_winner = 'defender' then 1 else 0 end
  where user_id = v_attacker_id;

  update public.player_progress
  set pvp_rating = greatest(0, pvp_rating + p_defender_rating_delta),
      pvp_peak_rating = greatest(pvp_peak_rating, greatest(0, pvp_rating + p_defender_rating_delta)),
      pvp_wins = pvp_wins + case when p_winner = 'defender' then 1 else 0 end,
      pvp_losses = pvp_losses + case when p_winner = 'attacker' then 1 else 0 end
  where user_id = p_defender_id;
end;
$$;

-- Global top-N PvP leaderboard (Team page's PvP section). security definer
-- since player_progress's RLS only lets a client read its own row.
create or replace function public.get_pvp_leaderboard(p_limit integer default 50)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  pvp_rating integer,
  pvp_peak_rating integer,
  pvp_wins integer,
  pvp_losses integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    row_number() over (order by pp.pvp_rating desc, pp.pvp_wins desc) as rank,
    pp.user_id,
    coalesce(pr.username, 'Node') as username,
    pp.pvp_rating,
    pp.pvp_peak_rating,
    pp.pvp_wins,
    pp.pvp_losses
  from public.player_progress pp
  left join public.profiles pr on pr.user_id = pp.user_id
  order by pp.pvp_rating desc, pp.pvp_wins desc
  limit greatest(1, least(p_limit, 200));
$$;

grant execute on function public.get_pvp_leaderboard(integer) to authenticated;

-- Rating lookup for a specific set of user ids — same RLS gap as the
-- leaderboard above. Used by usePvp.ts's findOpponents to show real ratings
-- for the candidate ids it already got from pvp_defense_teams (which IS
-- publicly readable, migration 0011) instead of always falling back to the
-- default 1000.
create or replace function public.get_pvp_ratings(p_user_ids uuid[])
returns table (
  user_id uuid,
  pvp_rating integer
)
language sql
security definer
set search_path = public
stable
as $$
  select pp.user_id, pp.pvp_rating
  from public.player_progress pp
  where pp.user_id = any(p_user_ids);
$$;

grant execute on function public.get_pvp_ratings(uuid[]) to authenticated;

-- The caller's own leaderboard position (1-indexed, ties broken the same
-- way as get_pvp_leaderboard would rank them) + total ranked player count,
-- for a "#N de TOTAL" display outside the top-N leaderboard slice.
create or replace function public.get_my_pvp_rank()
returns table (
  rank bigint,
  total bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*) + 1 from public.player_progress where pvp_rating > my.pvp_rating) as rank,
    (select count(*) from public.player_progress) as total
  from public.player_progress my
  where my.user_id = auth.uid();
$$;

grant execute on function public.get_my_pvp_rank() to authenticated;
