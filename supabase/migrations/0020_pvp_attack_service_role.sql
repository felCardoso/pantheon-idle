-- Pantheon Idle: close the PvP rating-forgery hole in resolve_pvp_attack.
--
-- THE PROBLEM
-- resolve_pvp_attack (migrations 0011/0018) is `security definer` and was
-- granted to `authenticated`, while taking the winner and BOTH rating deltas as
-- client-supplied parameters and validating only that p_winner is one of two
-- strings. Any logged-in player could call it straight from the browser with the
-- anon client:
--
--   supabase.rpc('resolve_pvp_attack', {
--     p_defender_id: <any user>, p_winner: 'attacker', p_log: [],
--     p_attacker_rating_delta: 999999, p_defender_rating_delta: -999999,
--   })
--
-- ...setting their own rating and peak arbitrarily, tanking any other player's
-- rating, inflating their win count, and writing fabricated battle history.
--
-- That defeats the entire stated reason the battle runs inside the pvp-attack
-- Edge Function ("so a motivated player can't tamper with client-side battle
-- computation to inflate their own rating at another real player's expense").
-- Computing the fight server-side is worthless while the call that COMMITS the
-- outcome trusts whatever the client passes.
--
-- Worse, the Edge Function forwarded the caller's own JWT to this RPC, so
-- auth.uid() was identical for a legitimate call and a forged one — the function
-- had no way to tell them apart.
--
-- THE FIX
-- Commit through the service_role key, which the browser never holds, and take
-- the attacker as an explicit parameter (auth.uid() is null under service_role).
-- The Edge Function still verifies the caller's JWT to learn who the attacker
-- really is, and still uses the caller's own JWT for every read, so RLS is
-- unchanged; only this one privileged write moves behind service_role.

-- The old 5-argument signature must be dropped explicitly. The new function
-- below has a different argument list, so without this drop Postgres would keep
-- BOTH as overloads and the vulnerable one would stay callable by authenticated.
drop function if exists public.resolve_pvp_attack(uuid, text, jsonb, integer, integer);

create or replace function public.resolve_pvp_attack(
  p_attacker_id uuid,
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
begin
  if p_attacker_id is null or p_defender_id is null then
    raise exception 'attacker and defender are required';
  end if;
  if p_attacker_id = p_defender_id then
    raise exception 'cannot attack yourself';
  end if;
  if p_winner not in ('attacker', 'defender') then
    raise exception 'invalid winner: %', p_winner;
  end if;

  -- Defence in depth: even holding the service_role key, a bug in the Edge
  -- Function shouldn't be able to move a rating by an absurd amount. The Elo
  -- K-factor is 32, so a single attack can never legitimately exceed that.
  if abs(p_attacker_rating_delta) > 32 or abs(p_defender_rating_delta) > 32 then
    raise exception 'rating delta out of range';
  end if;

  insert into public.pvp_battles (attacker_id, defender_id, winner, log)
  values (p_attacker_id, p_defender_id, p_winner, p_log);

  update public.player_progress
  set pvp_rating = greatest(0, pvp_rating + p_attacker_rating_delta),
      pvp_peak_rating = greatest(pvp_peak_rating, greatest(0, pvp_rating + p_attacker_rating_delta)),
      pvp_wins = pvp_wins + case when p_winner = 'attacker' then 1 else 0 end,
      pvp_losses = pvp_losses + case when p_winner = 'defender' then 1 else 0 end
  where user_id = p_attacker_id;

  update public.player_progress
  set pvp_rating = greatest(0, pvp_rating + p_defender_rating_delta),
      pvp_peak_rating = greatest(pvp_peak_rating, greatest(0, pvp_rating + p_defender_rating_delta)),
      pvp_wins = pvp_wins + case when p_winner = 'defender' then 1 else 0 end,
      pvp_losses = pvp_losses + case when p_winner = 'attacker' then 1 else 0 end
  where user_id = p_defender_id;
end;
$$;

-- Only the Edge Function (service_role) may resolve an attack. `authenticated`
-- is explicitly revoked rather than merely not granted, so a project that
-- already ran 0011/0018 loses the old grant too.
revoke all on function public.resolve_pvp_attack(uuid, uuid, text, jsonb, integer, integer) from public;
revoke all on function public.resolve_pvp_attack(uuid, uuid, text, jsonb, integer, integer) from anon;
revoke all on function public.resolve_pvp_attack(uuid, uuid, text, jsonb, integer, integer) from authenticated;
grant execute on function public.resolve_pvp_attack(uuid, uuid, text, jsonb, integer, integer) to service_role;

-- Migration 0011 also let clients insert their own pvp_battles rows. Nothing in
-- the app ever did: the only writer is resolve_pvp_attack, which is `security
-- definer` and so bypasses RLS regardless. All the policy actually provided was
-- a way for any player to fabricate battle-history rows naming themselves as
-- attacker against any defender — rows that defender can then see, since the
-- select policy shows both participants. Drop the unused write surface.
drop policy if exists "Attackers can record a battle they just resolved" on public.pvp_battles;

-- ---------------------------------------------------------------------------
-- pvp_defense_teams: close the bypass around the hardened write path.
--
-- app/api/pvp/defense-team deliberately re-reads xp/rarity from
-- player_characters instead of trusting the request body, so a forged snapshot
-- can't hand a defense team fabricated stats. But migration 0011 also granted
-- clients direct insert/update on the table, so that hardening was optional:
-- the browser could skip the route and upsert the row itself with any xp,
-- rarity, character, or team size it wanted —
--
--   supabase.from('pvp_defense_teams').upsert({ user_id: me, characters: [...] })
--
-- — producing an unbeatable defense of arbitrarily many max-stat units. Revoke
-- the direct write; the API route uses the service-role key and so is unaffected.
drop policy if exists "Players can set their own defense team" on public.pvp_defense_teams;
drop policy if exists "Players can update their own defense team" on public.pvp_defense_teams;

-- Trim any oversized snapshot already stored before enforcing the cap, so the
-- constraint can be added validated rather than left NOT VALID.
update public.pvp_defense_teams
set characters = (
  select coalesce(jsonb_agg(elem), '[]'::jsonb)
  from (
    select elem from jsonb_array_elements(characters) with ordinality as t(elem, ord)
    order by ord limit 5
  ) trimmed
)
where jsonb_array_length(characters) > 5;

-- Matches player_teams' own constraint and docs/gdd.md section 5 ("times de até 5").
alter table public.pvp_defense_teams
  drop constraint if exists pvp_defense_teams_max_members;
alter table public.pvp_defense_teams
  add constraint pvp_defense_teams_max_members check (jsonb_array_length(characters) <= 5);
