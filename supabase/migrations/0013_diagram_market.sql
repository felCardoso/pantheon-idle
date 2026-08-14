-- Pantheon Idle: Mercado de Diagramas (docs/monetizacao-guilda.md section 1)
-- — Root Access (VIP) subscribers can publish/buy `.dat` (duplicate-character
-- fragments, public.character_fragments) with other players for Créditos.
-- Run this once in the Supabase SQL Editor, after migration 0012.

create table if not exists public.diagram_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users (id) on delete cascade,
  character_id text not null,
  quantity integer not null check (quantity > 0),
  price_credits integer not null check (price_credits > 0),
  created_at timestamptz not null default now()
);

alter table public.diagram_listings enable row level security;

create policy "Anyone signed in can browse listings"
  on public.diagram_listings for select
  using (auth.uid() is not null);

-- Deliberately no insert/update/delete policies for regular clients — every
-- write (publish/cancel/purchase) has to move fragments and/or credits
-- between the seller's and buyer's own rows atomically, so all three go
-- through the `security definer` functions below instead (same pattern as
-- migration 0011's resolve_pvp_attack), which run as the table owner and
-- always take the acting player from auth.uid(), never a client-supplied id.

create or replace function public.publish_diagram_listing(
  p_character_id text,
  p_quantity integer,
  p_price_credits integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid := auth.uid();
  v_available integer;
  v_listing_id uuid;
begin
  if v_seller_id is null then
    raise exception 'not authenticated';
  end if;
  if p_quantity <= 0 or p_price_credits <= 0 then
    raise exception 'invalid quantity or price';
  end if;
  if not exists (
    select 1 from public.player_progress
    where user_id = v_seller_id and vip_expires_at is not null and vip_expires_at > now()
  ) then
    raise exception 'Root Access required to publish listings';
  end if;

  select count into v_available from public.character_fragments
  where user_id = v_seller_id and character_id = p_character_id;

  if v_available is null or v_available < p_quantity then
    raise exception 'not enough diagrams';
  end if;

  update public.character_fragments
  set count = count - p_quantity
  where user_id = v_seller_id and character_id = p_character_id;

  insert into public.diagram_listings (seller_id, character_id, quantity, price_credits)
  values (v_seller_id, p_character_id, p_quantity, p_price_credits)
  returning id into v_listing_id;

  return v_listing_id;
end;
$$;

grant execute on function public.publish_diagram_listing(text, integer, integer) to authenticated;

create or replace function public.cancel_diagram_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_seller_id uuid;
  v_character_id text;
  v_quantity integer;
begin
  if v_caller_id is null then
    raise exception 'not authenticated';
  end if;

  select seller_id, character_id, quantity into v_seller_id, v_character_id, v_quantity
  from public.diagram_listings
  where id = p_listing_id
  for update;

  if v_seller_id is null then
    raise exception 'listing not found';
  end if;
  if v_seller_id <> v_caller_id then
    raise exception 'not your listing';
  end if;

  insert into public.character_fragments (user_id, character_id, count)
  values (v_seller_id, v_character_id, v_quantity)
  on conflict (user_id, character_id) do update set count = character_fragments.count + excluded.count;

  delete from public.diagram_listings where id = p_listing_id;
end;
$$;

grant execute on function public.cancel_diagram_listing(uuid) to authenticated;

create or replace function public.purchase_diagram_listing(
  p_listing_id uuid,
  p_quantity integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_seller_id uuid;
  v_character_id text;
  v_available integer;
  v_price_credits integer;
  v_total_credits integer;
  v_buyer_credits integer;
begin
  if v_buyer_id is null then
    raise exception 'not authenticated';
  end if;
  if p_quantity <= 0 then
    raise exception 'invalid quantity';
  end if;
  if not exists (
    select 1 from public.player_progress
    where user_id = v_buyer_id and vip_expires_at is not null and vip_expires_at > now()
  ) then
    raise exception 'Root Access required to purchase';
  end if;

  select seller_id, character_id, quantity, price_credits
  into v_seller_id, v_character_id, v_available, v_price_credits
  from public.diagram_listings
  where id = p_listing_id
  for update;

  if v_seller_id is null then
    raise exception 'listing not found';
  end if;
  if v_seller_id = v_buyer_id then
    raise exception 'cannot buy your own listing';
  end if;
  if v_available < p_quantity then
    raise exception 'not enough stock';
  end if;

  v_total_credits := v_price_credits * p_quantity;

  select credits into v_buyer_credits from public.player_progress where user_id = v_buyer_id;
  if v_buyer_credits is null or v_buyer_credits < v_total_credits then
    raise exception 'not enough credits';
  end if;

  update public.player_progress set credits = credits - v_total_credits where user_id = v_buyer_id;
  update public.player_progress set credits = credits + v_total_credits where user_id = v_seller_id;

  insert into public.character_fragments (user_id, character_id, count)
  values (v_buyer_id, v_character_id, p_quantity)
  on conflict (user_id, character_id) do update set count = character_fragments.count + excluded.count;

  if v_available = p_quantity then
    delete from public.diagram_listings where id = p_listing_id;
  else
    update public.diagram_listings set quantity = quantity - p_quantity where id = p_listing_id;
  end if;
end;
$$;

grant execute on function public.purchase_diagram_listing(uuid, integer) to authenticated;
