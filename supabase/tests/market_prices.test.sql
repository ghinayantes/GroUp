begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select has_table('public', 'market_commodities', 'market_commodities exists');
select has_table('public', 'market_price_snapshots', 'market_price_snapshots exists');
select has_view('public', 'market_prices_latest', 'market_prices_latest exists');
select has_column('public', 'patungans', 'commodity_slug', 'patungans links to a commodity');

select is((select count(*)::int from public.market_commodities), 13, 'catalog is seeded with 13 commodities');
select is(
  (select count(*)::int from public.market_commodities where unit <> 'kg'),
  0,
  'every seeded commodity is priced per kg'
);

insert into public.market_price_snapshots (
  commodity_slug, region, mode, horizon, last_price, last_observed_at, target_date,
  forecast_price, forecast_low, forecast_high, change_pct, status, advice, model,
  mape_pct, n_points, source, notes, generated_at
) values
  ('bawang_merah', 'kota_bandung', 'bulanan', '1_bulan', 38000, '2026-10-01', '2026-11-01',
   37000, 30000, 42000, -2.63, 'BERGEJOLAK', 'Beli sesuai kebutuhan', 'naive',
   15, 10, 'PIHPS', '{}', '2026-10-05T10:00:00+07'),
  ('bawang_merah', 'kota_bandung', 'bulanan', '1_bulan', 35000, '2026-11-02', '2026-12-01',
   35000, 26000, 41100, 0, 'BERGEJOLAK', 'Harga bergejolak, beli sesuai kebutuhan', 'naive',
   14.98, 11, 'PIHPS', '{"Data bulanan"}', '2026-11-08T22:29:25+07');

select is(
  (select last_price from public.market_prices_latest where commodity_slug = 'bawang_merah'),
  35000::numeric,
  'view returns the newest snapshot per commodity'
);

select is(
  (select label || '|' || unit from public.market_prices_latest where commodity_slug = 'bawang_merah'),
  'Bawang Merah|kg',
  'view joins commodity label and unit'
);

select throws_ok(
  $$ insert into public.market_price_snapshots (
       commodity_slug, region, mode, horizon, last_price, last_observed_at, status, source, generated_at
     ) values ('bawang_merah', 'kota_bandung', 'bulanan', '1_bulan', 36000, '2026-11-02', 'STABIL', 'PIHPS',
       '2026-11-08T22:29:25+07') $$,
  '23505',
  null,
  'importing the same generated_at twice is rejected'
);

select throws_ok(
  $$ insert into public.market_price_snapshots (
       commodity_slug, region, mode, horizon, last_price, last_observed_at, status, source, generated_at
     ) values ('bawang_merah', 'kota_bandung', 'bulanan', '1_bulan', 36000, '2026-11-02', 'MELONJAK', 'PIHPS',
       now()) $$,
  '23514',
  null,
  'unknown status is rejected'
);

insert into public.suppliers (id, display_name, is_verified)
values ('00000000-0000-4000-8000-000000000011', 'Supplier Harga', true);
insert into public.market_commodities (slug, label, unit, aliases, perishable)
values ('komoditas_uji', 'Komoditas Uji', 'kg', '{uji}', false);
insert into public.patungans (id, supplier_id, material_name, category, unit, min_quantity, closes_at, commodity_slug)
values (
  '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000011',
  'Bahan Uji', 'bumbu', 'kg', 10, now() + interval '7 days', 'komoditas_uji'
);
delete from public.market_commodities where slug = 'komoditas_uji';

select is(
  (select commodity_slug from public.patungans where id = '00000000-0000-4000-8000-000000000012'),
  null,
  'deleting a commodity keeps the batch and clears its link'
);

set local role anon;

select is(
  (select count(*)::int from public.market_prices_latest where commodity_slug = 'bawang_merah'),
  1,
  'anon can read the latest market prices'
);

select throws_ok(
  $$ insert into public.market_price_snapshots (
       commodity_slug, region, mode, horizon, last_price, last_observed_at, status, source, generated_at
     ) values ('gula_pasir', 'kota_bandung', 'bulanan', '1_bulan', 19000, '2026-11-02', 'STABIL', 'PIHPS', now()) $$,
  '42501',
  null,
  'anon cannot write market price snapshots'
);

reset role;

select * from finish();
rollback;
