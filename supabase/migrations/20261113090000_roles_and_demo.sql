-- Login per peran: pemilik supplier (grosir), pemilik pesanan (pembeli), tools di trace agen,
-- dan penanda data seed demo yang dikembalikan oleh reset harian.

alter table public.suppliers
  add column owner_user_id uuid unique references auth.users(id) on delete set null,
  add column demo_seed jsonb;

alter table public.orders
  add column buyer_user_id uuid references auth.users(id) on delete set null,
  add column demo_seed jsonb;
create index orders_buyer_user_idx on public.orders (buyer_user_id, created_at desc) where buyer_user_id is not null;

alter table public.patungans add column demo_seed jsonb;
alter table public.demand_interests add column demo_seed jsonb;
alter table public.agent_traces add column tools text[];

drop function public.create_group_order(uuid, text, text, numeric, text, text, text);
create function public.create_group_order(
  p_patungan_id uuid,
  p_customer_name text,
  p_phone text,
  p_quantity numeric,
  p_channel text,
  p_management_code_hash text,
  p_provider_message_id text,
  p_buyer_user_id uuid
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
  if p_buyer_user_id is not null and p_channel <> 'website' then
    raise exception 'invalid_order' using errcode = '22023';
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
    patungan_id, customer_name, phone, quantity, channel, management_code_hash, provider_message_id, buyer_user_id
  ) values (
    p_patungan_id, trim(p_customer_name), p_phone, p_quantity, p_channel, p_management_code_hash, p_provider_message_id, p_buyer_user_id
  ) on conflict (provider_message_id) do update set provider_message_id = excluded.provider_message_id
  returning id into v_order_id;

  return v_order_id;
end;
$$;

drop function public.manage_group_order(uuid, text, text, text, numeric);
create function public.manage_group_order(
  p_order_id uuid,
  p_phone text,
  p_management_code_hash text,
  p_buyer_user_id uuid,
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
    or (p_buyer_user_id is not null and v_order.buyer_user_id = p_buyer_user_id)
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

-- Admin menghubungkan akun grosir yang sudah ada ke supplier lewat email.
create function public.link_supplier_owner(p_supplier_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users
    where lower(email) = lower(trim(p_email)) and raw_app_meta_data->>'role' = 'grosir';
  if v_user_id is null then raise exception 'grosir_not_found' using errcode = 'P0001'; end if;
  if exists (select 1 from public.suppliers where owner_user_id = v_user_id and id <> p_supplier_id) then
    raise exception 'owner_taken' using errcode = 'P0001';
  end if;
  update public.suppliers set owner_user_id = v_user_id, updated_at = now() where id = p_supplier_id;
  if not found then raise exception 'supplier_not_found' using errcode = 'P0001'; end if;
  return v_user_id;
end;
$$;

-- Menghapus data yang dibuat akun demo setelah seed dan mengembalikan data seed ke keadaan awalnya.
-- demo_seed menyimpan keadaan awal; closes_in dan age relatif terhadap waktu reset.
create function public.reset_demo_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_demo_users uuid[];
  v_demo_batches uuid[];
begin
  select coalesce(array_agg(id), '{}') into v_demo_users from auth.users where raw_app_meta_data->>'demo' = 'true';
  select coalesce(array_agg(p.id), '{}') into v_demo_batches from public.patungans p
    where p.demo_seed is not null
      or p.created_by = any(v_demo_users)
      or p.supplier_id in (select s.id from public.suppliers s where s.owner_user_id = any(v_demo_users));

  delete from public.orders o
    where o.demo_seed is null
      and (o.buyer_user_id = any(v_demo_users) or o.patungan_id = any(v_demo_batches));
  delete from public.patungans p
    where p.demo_seed is null and p.id = any(v_demo_batches);

  update public.patungans set
    status = demo_seed->>'status',
    closes_at = now() + (demo_seed->>'closes_in')::interval,
    final_quantity = (demo_seed->>'final_quantity')::numeric,
    final_unit_price = (demo_seed->>'final_unit_price')::numeric,
    updated_at = now()
  where demo_seed is not null;

  update public.orders set
    status = demo_seed->>'status',
    quantity = (demo_seed->>'quantity')::numeric,
    final_unit_price = (demo_seed->>'final_unit_price')::numeric,
    payment_status = demo_seed->>'payment_status',
    fulfillment_status = demo_seed->>'fulfillment_status',
    updated_at = now()
  where demo_seed is not null;

  update public.suppliers set
    is_verified = (demo_seed->>'is_verified')::boolean,
    verification_note = demo_seed->>'verification_note',
    updated_at = now()
  where demo_seed is not null;

  update public.demand_interests set
    status = 'active',
    created_at = now() - (demo_seed->>'age')::interval
  where demo_seed is not null;
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
  perform public.reset_demo_data();
end;
$$;

revoke all on function public.create_group_order(uuid, text, text, numeric, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.manage_group_order(uuid, text, text, uuid, text, numeric) from public, anon, authenticated;
revoke all on function public.link_supplier_owner(uuid, text) from public, anon, authenticated;
revoke all on function public.reset_demo_data() from public, anon, authenticated;
grant execute on function public.create_group_order(uuid, text, text, numeric, text, text, text, uuid) to service_role;
grant execute on function public.manage_group_order(uuid, text, text, uuid, text, numeric) to service_role;
grant execute on function public.link_supplier_owner(uuid, text) to service_role;
grant execute on function public.reset_demo_data() to service_role;
