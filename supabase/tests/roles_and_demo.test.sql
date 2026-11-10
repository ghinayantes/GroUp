begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select has_column('public', 'suppliers', 'owner_user_id', 'suppliers.owner_user_id exists');
select col_is_unique('public', 'suppliers', 'owner_user_id', 'suppliers.owner_user_id is unique');
select has_column('public', 'orders', 'buyer_user_id', 'orders.buyer_user_id exists');
select has_index('public', 'orders', 'orders_buyer_user_idx', 'orders.buyer_user_id is indexed');
select has_column('public', 'agent_traces', 'tools', 'agent_traces.tools exists');

select ok(not has_function_privilege('anon', 'public.reset_demo_data()', 'execute'), 'anon cannot reset demo data');
select ok(not has_function_privilege('authenticated', 'public.reset_demo_data()', 'execute'), 'authenticated cannot reset demo data');
select ok(not has_function_privilege('authenticated', 'public.link_supplier_owner(uuid, text)', 'execute'), 'authenticated cannot link supplier owners');
select ok(has_function_privilege('service_role', 'public.reset_demo_data()', 'execute'), 'service_role can reset demo data');
select ok(not has_table_privilege('anon', 'public.orders', 'select'), 'anon cannot read orders');

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-4000-8000-0000000000a1', 'pembeli.demo@test', '{"role":"pembeli","demo":true}'),
  ('00000000-0000-4000-8000-0000000000a2', 'grosir.demo@test', '{"role":"grosir","demo":true}'),
  ('00000000-0000-4000-8000-0000000000a3', 'pembeli.asli@test', '{"role":"pembeli"}');

insert into public.suppliers (id, display_name, is_verified, verification_note, owner_user_id, demo_seed) values
  ('00000000-0000-4000-8000-0000000000b1', 'Grosir Demo', false, 'diubah', '00000000-0000-4000-8000-0000000000a2',
   '{"is_verified":true,"verification_note":"NIB dicek"}');

insert into public.patungans (id, supplier_id, material_name, category, unit, min_quantity, closes_at, status, final_quantity, final_unit_price, demo_seed) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b1', 'Cabai Merah Keriting', 'Sayuran', 'kg', 100,
   now() - interval '1 day', 'successful', 120, 40000,
   '{"status":"open","closes_in":"3 days","final_quantity":null,"final_unit_price":null}'),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000b1', 'Batch buatan grosir demo', 'Sayuran', 'kg', 50,
   now() + interval '2 days', 'open', null, null, null);

insert into public.orders (id, patungan_id, customer_name, phone, quantity, channel, status, management_code_hash, buyer_user_id, payment_status, demo_seed) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000c1', 'Pembeli Demo', '080000000001', 7, 'website', 'cancelled', 'hash-1',
   '00000000-0000-4000-8000-0000000000a1', 'due',
   '{"status":"confirmed","quantity":5,"final_unit_price":null,"payment_status":"not_due","fulfillment_status":"pending"}'),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000c1', 'Pembeli Demo', '080000000001', 3, 'website', 'confirmed', 'hash-2',
   '00000000-0000-4000-8000-0000000000a1', 'not_due', null),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000c2', 'Pembeli Asli', '080000000002', 4, 'website', 'confirmed', 'hash-3',
   '00000000-0000-4000-8000-0000000000a3', 'not_due', null);

select public.reset_demo_data();

select is((select count(*)::int from public.orders where id = '00000000-0000-4000-8000-0000000000d2'), 0, 'non-seed order of the demo buyer is deleted');
select is((select count(*)::int from public.patungans where id = '00000000-0000-4000-8000-0000000000c2'), 0, 'non-seed batch of the demo grosir is deleted with its orders');
select results_eq(
  $$ select status, final_quantity, final_unit_price, closes_at > now() + interval '2 days' from public.patungans where id = '00000000-0000-4000-8000-0000000000c1' $$,
  $$ values ('open'::text, null::numeric, null::numeric, true) $$,
  'seed batch is restored to open with a fresh deadline'
);
select results_eq(
  $$ select status, quantity, payment_status from public.orders where id = '00000000-0000-4000-8000-0000000000d1' $$,
  $$ values ('confirmed'::text, 5::numeric, 'not_due'::text) $$,
  'seed order is restored'
);
select results_eq(
  $$ select is_verified, verification_note from public.suppliers where id = '00000000-0000-4000-8000-0000000000b1' $$,
  $$ values (true, 'NIB dicek'::text) $$,
  'seed supplier verification is restored'
);
select lives_ok($$ select public.cleanup_agent_data() $$, 'cleanup_agent_data runs the demo reset');

select * from finish();
rollback;
