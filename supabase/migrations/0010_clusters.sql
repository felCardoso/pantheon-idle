-- Pantheon Idle: guild system — "Cluster" (docs/monetizacao-guilda.md section 2).
-- Run this once in the Supabase SQL Editor, after migration 0009.

create table if not exists public.clusters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag text,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists clusters_name_unique on public.clusters (lower(name));

alter table public.clusters enable row level security;

create policy "Anyone signed in can browse clusters"
  on public.clusters for select
  using (auth.uid() is not null);

create policy "Players can create a cluster as themselves"
  on public.clusters for insert
  with check (auth.uid() = created_by);

-- A player belongs to at most one Cluster at a time — enforced by the unique
-- index on user_id below (a plain unique column, not part of the composite
-- primary key, so "insert my own membership" fails outright if already in
-- one; the app is expected to leave first).
create table if not exists public.cluster_members (
  cluster_id uuid not null references public.clusters (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'node' check (role in ('leader', 'officer', 'node')),
  joined_at timestamptz not null default now(),
  primary key (cluster_id, user_id)
);
create unique index if not exists cluster_members_user_unique on public.cluster_members (user_id);

alter table public.cluster_members enable row level security;

create policy "Anyone signed in can see cluster rosters"
  on public.cluster_members for select
  using (auth.uid() is not null);

create policy "Players can add their own membership row"
  on public.cluster_members for insert
  with check (auth.uid() = user_id);

create policy "Officers can change roles within their own cluster"
  on public.cluster_members for update
  using (
    exists (
      select 1 from public.cluster_members m
      where m.cluster_id = cluster_members.cluster_id
        and m.user_id = auth.uid()
        and m.role in ('leader', 'officer')
    )
  )
  with check (
    exists (
      select 1 from public.cluster_members m
      where m.cluster_id = cluster_members.cluster_id
        and m.user_id = auth.uid()
        and m.role in ('leader', 'officer')
    )
  );

create policy "Players can leave their own cluster"
  on public.cluster_members for delete
  using (auth.uid() = user_id);

create policy "Officers can remove members from their own cluster"
  on public.cluster_members for delete
  using (
    exists (
      select 1 from public.cluster_members m
      where m.cluster_id = cluster_members.cluster_id
        and m.user_id = auth.uid()
        and m.role in ('leader', 'officer')
    )
  );

create table if not exists public.cluster_messages (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.clusters (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.cluster_messages enable row level security;

create policy "Cluster members can read their cluster's chat"
  on public.cluster_messages for select
  using (
    exists (
      select 1 from public.cluster_members m
      where m.cluster_id = cluster_messages.cluster_id
        and m.user_id = auth.uid()
    )
  );

create policy "Cluster members can post to their cluster's chat"
  on public.cluster_messages for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.cluster_members m
      where m.cluster_id = cluster_messages.cluster_id
        and m.user_id = auth.uid()
    )
  );

-- Bandwidth is the Cluster-only currency (docs section 2): earned only via
-- guild activities (not built yet — the DDoS Raid cooperative boss is a
-- deliberate follow-up, see PR description), spent only in a future Cluster
-- shop. No conversion with Créditos/Tokens in either direction.
alter table public.player_progress add column if not exists bandwidth integer not null default 0;
