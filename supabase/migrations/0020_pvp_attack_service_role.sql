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
