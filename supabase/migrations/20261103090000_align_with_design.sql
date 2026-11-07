-- Menyelaraskan skema dengan rancangan: batas kuantitas wajar, catatan verifikasi supplier,
-- status pembayaran/penyerahan yang konsisten dengan hasil batch, dan riwayat batch selesai.

alter table public.orders
  add constraint orders_quantity_reasonable check (quantity <= 100000);

alter table public.suppliers
  add column if not exists verification_note text not null default '',
  add column if not exists verified_at timestamptz;

create index if not exists patungans_supplier_status_idx on public.patungans (supplier_id, status);

-- Pembeli boleh melihat batch yang sudah ditutup (riwayat/hasil), bukan hanya yang terbuka.
drop policy if exists "Public can view open batches" on public.patungans;
create policy "Public can view batches"
  on public.patungans for select to anon, authenticated
  using (status in ('open', 'successful', 'failed'));

drop policy if exists "Public can view tiers for open batches" on public.patungan_price_tiers;
create policy "Public can view tiers for visible batches"
  on public.patungan_price_tiers for select to anon, authenticated
  using (exists (select 1 from public.patungans p where p.id = patungan_id and p.status in ('open', 'successful', 'failed')));

drop policy if exists "Public can view suppliers for open batches" on public.suppliers;
create policy "Public can view suppliers for visible batches"
  on public.suppliers for select to anon, authenticated
  using (exists (select 1 from public.patungans p where p.supplier_id = suppliers.id and p.status in ('open', 'successful', 'failed')));

-- Kuantitas wajar juga divalidasi di fungsi pesanan.
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

  if p_action = 'update' and p_quantity is not null and p_quantity > 0 and p_quantity <= 100000 then
    update public.orders set quantity = p_quantity, updated_at = now() where id = p_order_id;
  elsif p_action = 'cancel' then
    update public.orders set status = 'cancelled', updated_at = now() where id = p_order_id;
  else
    raise exception 'invalid_action' using errcode = '22023';
  end if;
end;
$$;

-- Pencatatan status manual oleh admin: pembayaran/penyerahan hanya untuk batch yang berhasil.
create or replace function public.set_order_progress(
  p_order_id uuid,
  p_payment_status text,
  p_fulfillment_status text
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
  select * into v_batch from public.patungans where id = v_order.patungan_id;
  if v_batch.status <> 'successful' then raise exception 'batch_not_successful' using errcode = 'P0001'; end if;
  if p_payment_status not in ('due', 'paid', 'refunded') or p_fulfillment_status not in ('pending', 'ready', 'collected', 'delivered') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  update public.orders
    set payment_status = p_payment_status, fulfillment_status = p_fulfillment_status, updated_at = now()
    where id = p_order_id;
end;
$$;

revoke all on function public.set_order_progress(uuid, text, text) from public, anon, authenticated;
grant execute on function public.set_order_progress(uuid, text, text) to service_role;
