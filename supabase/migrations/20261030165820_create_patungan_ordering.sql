create extension if not exists pgcrypto with schema extensions;

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(trim(display_name)) between 2 and 120),
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.patungans (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  material_name text not null check (length(trim(material_name)) between 2 and 160),
  category text not null,
  unit text not null,
  image_url text,
  min_quantity numeric(12,3) not null check (min_quantity > 0),
  closes_at timestamptz not null,
  payment_instructions text not null default '',
  fulfillment_plan text not null default '',
  status text not null default 'open' check (status in ('open', 'successful', 'failed', 'cancelled')),
  final_quantity numeric(12,3),
  final_unit_price numeric(14,2),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.patungan_price_tiers (
  id uuid primary key default gen_random_uuid(),
  patungan_id uuid not null references public.patungans(id) on delete cascade,
  min_quantity numeric(12,3) not null check (min_quantity > 0),
  unit_price numeric(14,2) not null check (unit_price > 0),
  created_at timestamptz not null default now(),
  unique (patungan_id, min_quantity)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  patungan_id uuid not null references public.patungans(id) on delete restrict,
  customer_name text not null check (length(trim(customer_name)) between 2 and 120),
  phone text not null check (length(phone) between 8 and 24),
  quantity numeric(12,3) not null check (quantity > 0),
  channel text not null check (channel in ('website', 'whatsapp')),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  management_code_hash text,
  provider_message_id text unique,
  final_unit_price numeric(14,2),
  payment_status text not null default 'not_due' check (payment_status in ('not_due', 'due', 'paid', 'refunded')),
  fulfillment_status text not null default 'pending' check (fulfillment_status in ('pending', 'ready', 'collected', 'delivered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((channel = 'website' and management_code_hash is not null) or channel = 'whatsapp')
);

create table public.whatsapp_sessions (
  phone text primary key check (length(phone) between 8 and 24),
  stage text not null check (stage in ('choose_batch', 'enter_quantity', 'confirm_order')),
  patungan_id uuid references public.patungans(id) on delete set null,
  quantity numeric(12,3) check (quantity is null or quantity > 0),
  customer_name text,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table public.inbound_messages (
  provider_message_id text primary key,
  phone text not null,
  received_at timestamptz not null default now()
);

create index patungans_open_closes_at_idx on public.patungans (closes_at) where status = 'open';
create index patungan_price_tiers_lookup_idx on public.patungan_price_tiers (patungan_id, min_quantity);
create index orders_patungan_status_idx on public.orders (patungan_id, status);
create index orders_phone_created_idx on public.orders (phone, created_at desc);
create index orders_management_code_hash_idx on public.orders (management_code_hash) where management_code_hash is not null;
create index whatsapp_sessions_expiry_idx on public.whatsapp_sessions (expires_at);

alter table public.suppliers enable row level security;
alter table public.patungans enable row level security;
alter table public.patungan_price_tiers enable row level security;
alter table public.orders enable row level security;
alter table public.whatsapp_sessions enable row level security;
alter table public.inbound_messages enable row level security;

grant select on public.suppliers, public.patungans, public.patungan_price_tiers to anon, authenticated;
grant all on public.suppliers, public.patungans, public.patungan_price_tiers, public.orders, public.whatsapp_sessions, public.inbound_messages to service_role;

create policy "Public can view suppliers for open batches"
  on public.suppliers for select to anon, authenticated
  using (exists (select 1 from public.patungans p where p.supplier_id = suppliers.id and p.status = 'open' and p.closes_at > now()));

create policy "Public can view open batches"
  on public.patungans for select to anon, authenticated
  using (status = 'open' and closes_at > now());

create policy "Public can view tiers for open batches"
  on public.patungan_price_tiers for select to anon, authenticated
  using (exists (select 1 from public.patungans p where p.id = patungan_id and p.status = 'open' and p.closes_at > now()));

create or replace function public.create_group_order(
  p_patungan_id uuid,
  p_customer_name text,
  p_phone text,
  p_quantity numeric,
  p_channel text,
  p_management_code_hash text,
  p_provider_message_id text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.patungans%rowtype;
  v_order_id uuid;
begin
  if p_channel not in ('website', 'whatsapp') or p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_order' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_customer_name, ''))) < 2 or length(coalesce(p_phone, '')) < 8 then
    raise exception 'invalid_customer' using errcode = '22023';
  end if;
  if p_channel = 'website' and p_management_code_hash is null then
    raise exception 'missing_management_code' using errcode = '22023';
  end if;

  select * into v_batch from public.patungans where id = p_patungan_id for update;
  if not found or v_batch.status <> 'open' or v_batch.closes_at <= now() then
    raise exception 'batch_closed' using errcode = 'P0001';
  end if;

  insert into public.orders (
    patungan_id, customer_name, phone, quantity, channel, management_code_hash, provider_message_id
  ) values (
    p_patungan_id, trim(p_customer_name), p_phone, p_quantity, p_channel, p_management_code_hash, p_provider_message_id
  ) on conflict (provider_message_id) do update set provider_message_id = excluded.provider_message_id
  returning id into v_order_id;

  return v_order_id;
end;
$$;

create or replace function public.manage_group_order(
  p_order_id uuid,
  p_phone text,
  p_management_code_hash text,
  p_action text,
  p_quantity numeric
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_batch public.patungans%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status <> 'confirmed' then raise exception 'order_not_found' using errcode = 'P0001'; end if;

  if not (
    (v_order.channel = 'website' and p_management_code_hash is not null and v_order.management_code_hash = p_management_code_hash)
    or (v_order.channel = 'whatsapp' and p_phone is not null and v_order.phone = p_phone)
  ) then raise exception 'order_not_found' using errcode = 'P0001'; end if;

  select * into v_batch from public.patungans where id = v_order.patungan_id for update;
  if v_batch.status <> 'open' or v_batch.closes_at <= now() then raise exception 'batch_closed' using errcode = 'P0001'; end if;

  if p_action = 'update' and p_quantity is not null and p_quantity > 0 then
    update public.orders set quantity = p_quantity, updated_at = now() where id = p_order_id;
  elsif p_action = 'cancel' then
    update public.orders set status = 'cancelled', updated_at = now() where id = p_order_id;
  else
    raise exception 'invalid_action' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.create_group_batch(
  p_supplier_id uuid,
  p_material_name text,
  p_category text,
  p_unit text,
  p_image_url text,
  p_min_quantity numeric,
  p_closes_at timestamptz,
  p_payment_instructions text,
  p_fulfillment_plan text,
  p_tiers jsonb,
  p_created_by uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_min_quantity is null or p_min_quantity <= 0 or p_closes_at <= now() or jsonb_typeof(p_tiers) <> 'array' then
    raise exception 'invalid_batch' using errcode = '22023';
  end if;
  insert into public.patungans (
    supplier_id, material_name, category, unit, image_url, min_quantity, closes_at,
    payment_instructions, fulfillment_plan, created_by
  ) values (
    p_supplier_id, trim(p_material_name), trim(p_category), trim(p_unit), nullif(trim(p_image_url), ''), p_min_quantity, p_closes_at,
    coalesce(p_payment_instructions, ''), coalesce(p_fulfillment_plan, ''), p_created_by
  ) returning id into v_id;

  insert into public.patungan_price_tiers (patungan_id, min_quantity, unit_price)
    select v_id, tier.min_quantity, tier.unit_price
    from jsonb_to_recordset(p_tiers) as tier(min_quantity numeric, unit_price numeric);

  if not exists (select 1 from public.patungan_price_tiers where patungan_id = v_id and min_quantity <= p_min_quantity) then
    raise exception 'first_price_tier_below_minimum_required' using errcode = '22023';
  end if;
  return v_id;
end;
$$;

create or replace function public.close_group_batch(p_patungan_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.patungans%rowtype;
  v_total numeric;
  v_price numeric;
begin
  select * into v_batch from public.patungans where id = p_patungan_id for update;
  if not found or v_batch.status <> 'open' then raise exception 'batch_not_open' using errcode = 'P0001'; end if;
  select coalesce(sum(quantity), 0) into v_total from public.orders where patungan_id = p_patungan_id and status = 'confirmed';

  if v_total < v_batch.min_quantity then
    update public.patungans set status = 'failed', final_quantity = v_total, updated_at = now() where id = p_patungan_id;
    return 'failed';
  end if;

  select unit_price into v_price from public.patungan_price_tiers
    where patungan_id = p_patungan_id and min_quantity <= v_total
    order by min_quantity desc limit 1;
  if v_price is null then raise exception 'missing_price_tier' using errcode = 'P0001'; end if;

  update public.patungans set status = 'successful', final_quantity = v_total, final_unit_price = v_price, updated_at = now() where id = p_patungan_id;
  update public.orders set final_unit_price = v_price, payment_status = 'due', updated_at = now()
    where patungan_id = p_patungan_id and status = 'confirmed';
  return 'successful';
end;
$$;

revoke all on function public.create_group_order(uuid, text, text, numeric, text, text, text) from public, anon, authenticated;
revoke all on function public.manage_group_order(uuid, text, text, text, numeric) from public, anon, authenticated;
revoke all on function public.create_group_batch(uuid, text, text, text, text, numeric, timestamptz, text, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.close_group_batch(uuid) from public, anon, authenticated;
grant execute on function public.create_group_order(uuid, text, text, numeric, text, text, text) to service_role;
grant execute on function public.manage_group_order(uuid, text, text, text, numeric) to service_role;
grant execute on function public.create_group_batch(uuid, text, text, text, text, numeric, timestamptz, text, text, jsonb, uuid) to service_role;
grant execute on function public.close_group_batch(uuid) to service_role;
