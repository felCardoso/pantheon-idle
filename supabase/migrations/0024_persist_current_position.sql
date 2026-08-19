-- Pantheon Idle: persist where the player currently *is*, not just how far they got.
--
-- player_progress.fase/estagio has always meant the frontier — the furthest
-- point ever reached. The live position could sit behind it (a
-- retirar-se-ao-perder retreat moves it back one estágio, and the map can
-- replay an earlier stage), but that only ever lived in React state.
--
-- That was self-consistent while everything was client-side. Migration 0022
-- persisted recovery_wins_remaining, and the recovery streak is defined as
-- "this many more wins *at the retreated estágio*" (progression.ts) — so
-- storing the streak without the position it belongs to left a reload putting
-- the player back on the frontier while still owing the streak. They would owe
-- five wins on the hardest stage they had ever reached, which is both harder
-- than intended and not what the retreat meant.
--
-- Nullable, falling back to the frontier, so existing rows keep working.

alter table public.player_progress
  add column if not exists current_fase integer;
alter table public.player_progress
  add column if not exists current_estagio integer;
