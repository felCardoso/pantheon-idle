-- Pantheon Idle: PvP 5x5 por turnos — substitui a resolução de batalha do PvP
-- assíncrono (o ranking/rating de migrations 0011/0018/0020 continua igual).
--
-- 1. `pvp_defense_teams` ganha `formation`: um mapa characterId -> 'front' | 'back'
--    (docs: linha de frente é o único alvo de efeitos de alvo único enquanto tiver
--    alguém vivo). Validado na API route (app/api/pvp/defense-team), não aqui —
--    um CHECK não pode fazer subquery sobre o próprio jsonb array de forma prática,
--    e a rota já revalida characterIds contra a posse do jogador do mesmo jeito.
alter table public.pvp_defense_teams
  add column if not exists formation jsonb not null default '{}'::jsonb;

-- 2. `pvp_turn_battles`: estado de uma partida por turnos em andamento. Ao contrário
-- de pvp_battles (histórico de partidas já resolvidas), esta tabela é só um
-- rascunho de trabalho das duas Edge Functions (pvp-turn-start/pvp-turn-act) —
-- nenhuma linha aqui é lida pelo cliente diretamente (por isso RLS fica ligado
-- sem NENHUMA policy: acesso só via service_role, que ignora RLS). A linha é
-- apagada assim que a partida termina (resolve_pvp_attack já cobre o histórico
-- permanente via pvp_battles).
create table if not exists public.pvp_turn_battles (
  id uuid primary key default gen_random_uuid(),
  attacker_id uuid not null references auth.users (id) on delete cascade,
  defender_id uuid not null references auth.users (id) on delete cascade,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pvp_turn_battles enable row level security;

-- Nenhuma policy concedida a authenticated/anon de propósito — só as Edge
-- Functions (service_role, que ignora RLS) leem/escrevem esta tabela.

create index if not exists pvp_turn_battles_attacker_id_idx on public.pvp_turn_battles (attacker_id);

-- Limpeza de partidas abandonadas (o jogador começou e nunca terminou): pvp-turn-start
-- apaga qualquer linha própria do atacante com mais de 1 hora antes de criar uma nova,
-- então isto nunca precisa de um cron — só evita acumular lixo indefinidamente.
