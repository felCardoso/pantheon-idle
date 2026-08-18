-- Pantheon Idle: stop clients writing the columns of player_progress that the
-- server is supposed to own.
--
-- THE PROBLEM
-- player_progress has a plain "Players can update their own progress" policy
-- (migration 0001) covering EVERY column of the row. RLS restricts *which rows*
-- a client may write, never which columns, so a logged-in player could run:
--
--   supabase.from('player_progress').update({
--     tokens: 999999, vip_expires_at: '2099-01-01', pvp_rating: 5000,
--     last_claim_at: '2020-01-01', unlocked_team_slots: 5,
--   }).eq('user_id', me)
--
-- That defeats essentially every hardened server path at once:
--   * tokens / bytes — the premium currencies /api/player/spend-tokens et al.
--     carefully debit after checking the balance.
--   * vip_expires_at — the paid Root Access subscription, granted by
--     /api/player/purchase-vip, and the gate on the whole Diagram Market.
--   * pvp_rating / pvp_peak_rating / pvp_wins / pvp_losses — which migration
--     0020 just moved behind the service-role key. Blocking forged *deltas*
--     accomplishes nothing while the client can assign the rating outright.
--   * last_claim_at — /api/idle/claim clamps a payout to 24h and reads the
--     timestamp server-side, but a client that can rewind it can re-claim the
--     cap on demand, forever.
--   * banner_pity / banner_guaranteed — the gacha pity counters.
--   * unlocked_team_slots / starter_boost_claimed — one-time purchases/grants.
--
-- THE FIX
-- Column-level privileges, which is the mechanism that actually expresses
-- "these columns, not those". The client keeps exactly the four columns it
-- legitimately writes today: fase, estagio, credits and xp are still reported by
-- the client, because battle resolution itself is still client-side (see the
-- note on saveProgress in src/hooks/usePlayerProgress.ts). That remains known,
-- deliberate debt and is unchanged here — this migration only stops that one
-- known gap from being a doorway to every other column.
--
-- Everything else stays writable by the API routes and Edge Functions, which use
-- the service-role key and are unaffected by grants to `authenticated`.

-- Column grants only take effect once the table-wide grant is gone: a bare
-- `GRANT UPDATE ON table` outranks any per-column grant.
revoke update on public.player_progress from authenticated;
revoke insert on public.player_progress from authenticated;

-- The row is created client-side on first load with these same columns, so the
-- insert grant has to cover user_id too (see usePlayerProgress's bootstrap insert).
grant insert (user_id, fase, estagio, credits, xp) on public.player_progress to authenticated;
grant update (fase, estagio, credits, xp) on public.player_progress to authenticated;

-- saveProgress upserts, which is INSERT ... ON CONFLICT DO UPDATE and therefore
-- needs both privilege sets above; nothing further is required for it to work.

-- Belt and braces: service_role should already hold these, but an explicit grant
-- keeps the server paths working regardless of how the project's roles were set up.
grant all on public.player_progress to service_role;
