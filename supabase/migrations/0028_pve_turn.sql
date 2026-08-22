-- Pantheon Idle: controle manual de PvE — o jogador pode assumir o controle de
-- uma batalha específica em vez do auto-jogado padrão (docs: "auto-jogado por
-- padrão, controle manual opcional por estágio").
--
-- `pve_turn_battles`: estado de uma batalha PvE por turnos em andamento,
-- controlada manualmente. Mesmo desenho de pvp_turn_battles (migration 0027):
-- só um rascunho de trabalho das rotas app/api/battle/turn-start e
-- app/api/battle/turn-act, nunca lido pelo cliente diretamente — RLS ligado
-- sem NENHUMA policy, só o service_role (lib/supabase-admin.ts) toca aqui.
-- A linha é apagada assim que a batalha termina (finalizeBattleOutcome em
-- lib/battle-resolve.ts já cobre o histórico permanente via player_progress).
create table if not exists public.pve_turn_battles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pve_turn_battles enable row level security;

-- Nenhuma policy concedida a authenticated/anon de propósito — só as rotas de
-- servidor (service_role, que ignora RLS) leem/escrevem esta tabela.

create index if not exists pve_turn_battles_user_id_idx on public.pve_turn_battles (user_id);

-- Limpeza de batalhas abandonadas (o jogador começou e nunca terminou):
-- turn-start apaga qualquer linha própria do jogador com mais de 1 hora antes
-- de criar uma nova, então isto nunca precisa de um cron.
