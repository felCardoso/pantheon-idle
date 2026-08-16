-- Pantheon Idle: real rarity-weighted gacha + per-character ability/passive
-- leveling + Banner Semanal hard pity (docs/gdd.md sections 7 and 10).
-- Run this once in the Supabase SQL Editor, after migration 0014.

-- player_characters: the card's current best rarity. Upgrading to a higher
-- rarity via a duplicate pull updates this in place (see useOwnedCharacters
-- .acquireCharacter) instead of creating a second row.
alter table public.player_characters
  add column if not exists rarity text not null default 'Alpha';

-- character_fragments: fragments now carry the rarity they were pulled at,
-- since Bytes-per-diagram conversion (migration 0014) pays out by rarity.
-- Same character can have separate fragment stacks at different rarities.
alter table public.character_fragments
  add column if not exists rarity text not null default 'Alpha';

alter table public.character_fragments
  drop constraint if exists character_fragments_pkey;

alter table public.character_fragments
  add constraint character_fragments_pkey primary key (user_id, character_id, rarity);

-- diagram_listings: Mercado P2P listings need to carry rarity too, or
-- trading a fragment would silently flatten it back to a generic stack.
alter table public.diagram_listings
  add column if not exists rarity text not null default 'Alpha';

-- Banner Semanal hard pity counter — increments by 1 per banner pull
-- (see GachaPage), resets to 0 once the guaranteed-character claim fires.
alter table public.player_progress
  add column if not exists banner_pity integer not null default 0;

-- Per-player, per-character ability/passive levels — shared across every
-- rarity copy of a character the player owns (never reset on a rarity
-- upgrade, unlike the character's XP-level). ability_level covers the
-- character's active kit (1-5, gated by owned rarity); passive_level covers
-- the passive ability specifically (0-2, locked below LTS).
create table if not exists public.character_ability_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  character_id text not null,
  ability_level integer not null default 1 check (ability_level between 1 and 5),
  passive_level integer not null default 0 check (passive_level between 0 and 2),
  primary key (user_id, character_id)
);

alter table public.character_ability_progress enable row level security;

create policy "Users can view their own ability progress"
  on public.character_ability_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert their own ability progress"
  on public.character_ability_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own ability progress"
  on public.character_ability_progress for update
  using (auth.uid() = user_id);

-- publish_diagram_listing needs a rarity param now, to pick which fragment
-- stack (of possibly several, one per rarity) is being sold.
create or replace function public.publish_diagram_listing(
  p_character_id text,
  p_quantity integer,
  p_price_credits integer,
  p_rarity text
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
  where user_id = v_seller_id and character_id = p_character_id and rarity = p_rarity;

  if v_available is null or v_available < p_quantity then
    raise exception 'not enough diagrams';
  end if;

  update public.character_fragments
  set count = count - p_quantity
  where user_id = v_seller_id and character_id = p_character_id and rarity = p_rarity;

  insert into public.diagram_listings (seller_id, character_id, quantity, price_credits, rarity)
  values (v_seller_id, p_character_id, p_quantity, p_price_credits, p_rarity)
  returning id into v_listing_id;

  return v_listing_id;
end;
$$;

grant execute on function public.publish_diagram_listing(text, integer, integer, text) to authenticated;

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
  v_rarity text;
begin
  if v_caller_id is null then
    raise exception 'not authenticated';
  end if;

  select seller_id, character_id, quantity, rarity into v_seller_id, v_character_id, v_quantity, v_rarity
  from public.diagram_listings
  where id = p_listing_id
  for update;

  if v_seller_id is null then
    raise exception 'listing not found';
  end if;
  if v_seller_id <> v_caller_id then
    raise exception 'not your listing';
  end if;

  insert into public.character_fragments (user_id, character_id, rarity, count)
  values (v_seller_id, v_character_id, v_rarity, v_quantity)
  on conflict (user_id, character_id, rarity) do update set count = character_fragments.count + excluded.count;

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
  v_rarity text;
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

  select seller_id, character_id, quantity, price_credits, rarity
  into v_seller_id, v_character_id, v_available, v_price_credits, v_rarity
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

  insert into public.character_fragments (user_id, character_id, rarity, count)
  values (v_buyer_id, v_character_id, v_rarity, p_quantity)
  on conflict (user_id, character_id, rarity) do update set count = character_fragments.count + excluded.count;

  if v_available = p_quantity then
    delete from public.diagram_listings where id = p_listing_id;
  else
    update public.diagram_listings set quantity = quantity - p_quantity where id = p_listing_id;
  end if;
end;
$$;

grant execute on function public.purchase_diagram_listing(uuid, integer) to authenticated;
