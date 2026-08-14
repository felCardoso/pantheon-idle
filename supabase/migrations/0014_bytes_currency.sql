-- Pantheon Idle: Bytes — a new currency earned by converting duplicate-
-- character fragments (.dat) into a tech-flavored currency via the Mercado's
-- "Meu Inventário" tab (replacing the old direct Créditos refund in Loja).
-- Run this once in the Supabase SQL Editor, after migration 0013.

alter table public.player_progress add column if not exists bytes integer not null default 0;
