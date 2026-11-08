-- Router agen AI dua tahap: kanal simulator, stage sesi baru, riwayat percakapan, trace teknis, dan minat pembeli.

alter table public.orders drop constraint orders_channel_check;
alter table public.orders add constraint orders_channel_check check (channel in ('website', 'whatsapp', 'simulator'));
alter table public.orders drop constraint orders_check;
alter table public.orders add constraint orders_management_code_check
  check ((channel = 'website' and management_code_hash is not null) or channel in ('whatsapp', 'simulator'));

alter table public.whatsapp_sessions add column channel text not null default 'whatsapp'
  check (channel in ('whatsapp', 'simulator'));
alter table public.whatsapp_sessions drop constraint whatsapp_sessions_stage_check;
alter table public.whatsapp_sessions add constraint whatsapp_sessions_stage_check
  check (stage in ('choose_batch', 'enter_quantity', 'confirm_order', 'confirm_change', 'confirm_cancel', 'confirm_interest'));
alter table public.whatsapp_sessions add column pending_action jsonb;

create table public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('whatsapp', 'simulator')),
  sender_key text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(content) <= 2000),
  ai_generated boolean not null default false,
  created_at timestamptz not null default now()
);
create index agent_messages_sender_idx on public.agent_messages (sender_key, created_at desc);

create table public.agent_traces (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  stage text not null check (stage in ('fixed', 'stage1', 'stage2', 'fallback')),
  intent text,
  confidence numeric(5,4),
  action text not null,
  model text,
  input_tokens int,
  output_tokens int,
  latency_ms int not null,
  sender_hash text not null,
  created_at timestamptz not null default now()
);
create index agent_traces_sender_stage_idx on public.agent_traces (sender_hash, stage, created_at desc);

create table public.demand_interests (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('website', 'whatsapp', 'simulator')),
  sender_key text not null,
  material text not null check (length(trim(material)) between 2 and 120),
  quantity numeric(12,3) check (quantity is null or (quantity > 0 and quantity <= 100000)),
  unit text,
  frequency text check (frequency in ('sekali', 'mingguan', 'bulanan')),
  status text not null default 'active' check (status in ('active', 'fulfilled', 'withdrawn')),
  created_at timestamptz not null default now()
);

alter table public.agent_messages enable row level security;
alter table public.agent_traces enable row level security;
alter table public.demand_interests enable row level security;

revoke all on public.agent_messages, public.agent_traces, public.demand_interests from anon, authenticated;
grant all on public.agent_messages, public.agent_traces, public.demand_interests to service_role;

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
  if p_channel not in ('website', 'whatsapp', 'simulator') or p_quantity is null or p_quantity <= 0 or p_quantity > 100000
    or p_quantity <> round(p_quantity, 3) then
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

  if p_channel = 'simulator' and (
    select count(*) from public.orders
    where patungan_id = p_patungan_id and channel = 'simulator' and status = 'confirmed'
  ) >= 50 then
    raise exception 'simulator_limit' using errcode = 'P0001';
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
    or (v_order.channel in ('whatsapp', 'simulator') and p_phone is not null and v_order.phone = p_phone)
  ) then raise exception 'order_not_found' using errcode = 'P0001'; end if;

  select * into v_batch from public.patungans where id = v_order.patungan_id for update;
  if v_batch.status <> 'open' or v_batch.closes_at <= now() then raise exception 'batch_closed' using errcode = 'P0001'; end if;

  if p_action = 'update' and p_quantity is not null and p_quantity > 0 and p_quantity <= 100000
    and p_quantity = round(p_quantity, 3) then
    update public.orders set quantity = p_quantity, updated_at = now() where id = p_order_id;
  elsif p_action = 'cancel' then
    update public.orders set status = 'cancelled', updated_at = now() where id = p_order_id;
  else
    raise exception 'invalid_action' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.record_demand_interest(
  p_channel text,
  p_sender_key text,
  p_material text,
  p_quantity numeric,
  p_unit text,
  p_frequency text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_channel is null or p_channel not in ('website', 'whatsapp', 'simulator')
    or length(trim(coalesce(p_sender_key, ''))) = 0
    or length(trim(coalesce(p_material, ''))) not between 2 and 120
    or (p_quantity is not null and (p_quantity <= 0 or p_quantity > 100000 or p_quantity <> round(p_quantity, 3)))
    or (p_frequency is not null and p_frequency not in ('sekali', 'mingguan', 'bulanan')) then
    raise exception 'invalid_interest' using errcode = '22023';
  end if;

  insert into public.demand_interests (channel, sender_key, material, quantity, unit, frequency)
  values (p_channel, p_sender_key, trim(p_material), p_quantity, nullif(trim(p_unit), ''), p_frequency)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.purge_simulator_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.orders o
    using public.patungans p
    where o.patungan_id = p.id and o.channel = 'simulator' and p.status = 'open';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.cleanup_agent_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.agent_messages where created_at < now() - interval '30 days';
  delete from public.inbound_messages where received_at < now() - interval '30 days';
  delete from public.agent_traces where created_at < now() - interval '90 days';
  delete from public.whatsapp_sessions where expires_at < now();
end;
$$;

revoke all on function public.create_group_order(uuid, text, text, numeric, text, text, text) from public, anon, authenticated;
revoke all on function public.manage_group_order(uuid, text, text, text, numeric) from public, anon, authenticated;
revoke all on function public.record_demand_interest(text, text, text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.purge_simulator_orders() from public, anon, authenticated;
revoke all on function public.cleanup_agent_data() from public, anon, authenticated;
grant execute on function public.create_group_order(uuid, text, text, numeric, text, text, text) to service_role;
grant execute on function public.manage_group_order(uuid, text, text, text, numeric) to service_role;
grant execute on function public.record_demand_interest(text, text, text, numeric, text, text) to service_role;
grant execute on function public.purge_simulator_orders() to service_role;
grant execute on function public.cleanup_agent_data() to service_role;
