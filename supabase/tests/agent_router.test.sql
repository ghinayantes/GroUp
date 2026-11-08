begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into public.suppliers (id, display_name, is_verified)
values ('00000000-0000-4000-8000-000000000001', 'Supplier Uji', true);

insert into public.patungans (id, supplier_id, material_name, category, unit, min_quantity, closes_at)
values (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'Semen Uji', 'semen', 'sak', 10, now() + interval '7 days'
);

select lives_ok(
  $$ select public.create_group_order(
       '00000000-0000-4000-8000-000000000002', 'Pengunjung simulator', 'sim-0123456789abcdef', 2,
       'simulator', null, 'sim-msg-1') $$,
  'simulator order without management code is accepted'
);

do $$
begin
  perform public.create_group_order(
    '00000000-0000-4000-8000-000000000002', 'Pengunjung simulator', 'sim-0123456789abcdef', 1,
    'simulator', null, 'sim-msg-' || g)
  from generate_series(2, 50) as g;
end;
$$;

select throws_like(
  $$ select public.create_group_order(
       '00000000-0000-4000-8000-000000000002', 'Pengunjung simulator', 'sim-0123456789abcdef', 1,
       'simulator', null, 'sim-msg-51') $$,
  '%simulator_limit%',
  '51st simulator order in the same batch is rejected'
);

select throws_like(
  $$ select public.create_group_order(
       '00000000-0000-4000-8000-000000000002', 'Pembeli Website', '081234567890', 1.0004,
       'website', 'hash-website-desimal', null) $$,
  '%invalid_order%',
  'order quantity with more than 3 decimals is rejected'
);

do $$
begin
  perform public.create_group_order(
    '00000000-0000-4000-8000-000000000002', 'Pembeli Website', '081234567890', 5,
    'website', 'hash-website-uji', null);
end;
$$;

select lives_ok(
  $$ select public.manage_group_order(
       (select id from public.orders where provider_message_id = 'sim-msg-1'),
       'sim-0123456789abcdef', null, 'update', 3) $$,
  'simulator order is managed with the matching sender key'
);

select throws_like(
  $$ select public.manage_group_order(
       (select id from public.orders where provider_message_id = 'sim-msg-1'),
       'sim-ffffffffffffffff', null, 'update', 4) $$,
  '%order_not_found%',
  'simulator order is hidden from a different sender key'
);

select is(public.purge_simulator_orders(), 50, 'purge removes every simulator order in open batches');

select is(
  (select count(*)::int from public.orders
   where patungan_id = '00000000-0000-4000-8000-000000000002' and channel = 'website'),
  1,
  'website order in the same batch survives the purge'
);

select throws_like(
  $$ select public.record_demand_interest('whatsapp', '6281234567890', 'Besi beton', 0, 'batang', 'mingguan') $$,
  '%invalid_interest%',
  'demand interest with zero quantity is rejected'
);

select throws_like(
  $$ select public.record_demand_interest('whatsapp', '6281234567890', 'Besi beton', 1.0004, 'batang', 'mingguan') $$,
  '%invalid_interest%',
  'demand interest quantity with more than 3 decimals is rejected'
);

select has_column('public', 'agent_messages', 'ai_generated', 'agent_messages stores ai_generated');

insert into public.agent_messages (channel, sender_key, role, content, created_at) values
  ('whatsapp', '6281234567890', 'user', 'pesan lama', now() - interval '31 days'),
  ('whatsapp', '6281234567890', 'user', 'pesan baru', now() - interval '1 day');

do $$ begin perform public.cleanup_agent_data(); end; $$;

select is(
  (select count(*)::int from public.agent_messages where content = 'pesan lama'),
  0,
  'cleanup removes agent messages older than 30 days'
);

select is(
  (select count(*)::int from public.agent_messages where content = 'pesan baru'),
  1,
  'cleanup keeps recent agent messages'
);

select is(has_function_privilege('anon', 'public.create_group_order(uuid, text, text, numeric, text, text, text)', 'execute'), false, 'anon cannot execute create_group_order');
select is(has_function_privilege('anon', 'public.manage_group_order(uuid, text, text, text, numeric)', 'execute'), false, 'anon cannot execute manage_group_order');
select is(has_function_privilege('anon', 'public.record_demand_interest(text, text, text, numeric, text, text)', 'execute'), false, 'anon cannot execute record_demand_interest');
select is(has_function_privilege('anon', 'public.purge_simulator_orders()', 'execute'), false, 'anon cannot execute purge_simulator_orders');
select is(has_function_privilege('anon', 'public.cleanup_agent_data()', 'execute'), false, 'anon cannot execute cleanup_agent_data');

select * from finish();
rollback;
