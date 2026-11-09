-- Harga pasar: katalog komoditas PIHPS, snapshot prediksi dari pipeline ML, dan tautan batch ke komoditas.

create table public.market_commodities (
  slug text primary key check (slug ~ '^[a-z0-9_]+$'),
  label text not null check (length(trim(label)) between 2 and 120),
  unit text not null check (unit in ('kg', 'liter')),
  aliases text[] not null default '{}',
  perishable boolean not null default false
);

create table public.market_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  commodity_slug text not null references public.market_commodities(slug) on delete cascade,
  region text not null,
  mode text not null check (mode in ('bulanan', 'harian')),
  horizon text not null,
  last_price numeric(14,2) not null check (last_price > 0),
  last_observed_at date not null,
  target_date date,
  forecast_price numeric(14,2) check (forecast_price is null or forecast_price > 0),
  forecast_low numeric(14,2),
  forecast_high numeric(14,2),
  change_pct numeric(7,2),
  status text not null check (status in ('STABIL', 'NAIK', 'TURUN', 'TIDAK PASTI', 'BERGEJOLAK')),
  advice text not null default '',
  model text,
  mape_pct numeric(7,2),
  n_points int,
  source text not null,
  notes text[] not null default '{}',
  generated_at timestamptz not null,
  imported_at timestamptz not null default now(),
  unique (commodity_slug, region, horizon, generated_at),
  check (forecast_low is null or forecast_high is null or forecast_low <= forecast_high)
);
create index market_price_snapshots_latest_idx
  on public.market_price_snapshots (commodity_slug, region, horizon, generated_at desc);

alter table public.patungans
  add column commodity_slug text references public.market_commodities(slug) on delete set null;

create view public.market_prices_latest with (security_invoker = true) as
select distinct on (s.commodity_slug, s.region, s.horizon)
  s.commodity_slug, c.label, c.unit, c.aliases, c.perishable,
  s.region, s.mode, s.horizon, s.last_price, s.last_observed_at, s.target_date,
  s.forecast_price, s.forecast_low, s.forecast_high, s.change_pct, s.status, s.advice,
  s.model, s.mape_pct, s.n_points, s.source, s.notes, s.generated_at, s.imported_at
from public.market_price_snapshots s
join public.market_commodities c on c.slug = s.commodity_slug
order by s.commodity_slug, s.region, s.horizon, s.generated_at desc;

alter table public.market_commodities enable row level security;
alter table public.market_price_snapshots enable row level security;

grant select on public.market_commodities, public.market_price_snapshots, public.market_prices_latest to anon, authenticated;
grant all on public.market_commodities, public.market_price_snapshots, public.market_prices_latest to service_role;

create policy "Public can view market commodities"
  on public.market_commodities for select to anon, authenticated using (true);

create policy "Public can view market price snapshots"
  on public.market_price_snapshots for select to anon, authenticated using (true);

insert into public.market_commodities (slug, label, unit, aliases, perishable) values
  ('beras_medium', 'Beras Medium', 'kg', '{beras,beras medium}', false),
  ('gula_pasir', 'Gula Pasir', 'kg', '{gula,gula pasir}', false),
  ('gula_pasir_kualitas_premium', 'Gula Pasir Premium', 'kg', '{gula premium,gula pasir premium}', false),
  ('minyak_goreng_curah', 'Minyak Goreng Curah', 'kg', '{minyak,minyak goreng,minyak curah,migor}', false),
  ('telur_ayam_ras', 'Telur Ayam Ras', 'kg', '{telur,telur ayam,telur ayam ras}', true),
  ('daging_ayam_ras', 'Daging Ayam Ras', 'kg', '{ayam,daging ayam,ayam potong,ayam ras}', true),
  ('daging_sapi', 'Daging Sapi', 'kg', '{sapi,daging sapi}', true),
  ('cabai_merah_keriting', 'Cabai Merah Keriting', 'kg', '{cabai keriting,cabai merah keriting}', true),
  ('cabai_merah_besar', 'Cabai Merah Besar', 'kg', '{cabai merah besar,cabai besar}', true),
  ('cabai_rawit_merah', 'Cabai Rawit Merah', 'kg', '{rawit merah,cabai rawit merah,cengek merah}', true),
  ('cabai_rawit_hijau', 'Cabai Rawit Hijau', 'kg', '{rawit hijau,cabai rawit hijau,cengek hijau}', true),
  ('bawang_merah', 'Bawang Merah', 'kg', '{bawang merah,bamer}', true),
  ('bawang_putih', 'Bawang Putih', 'kg', '{bawang putih,baput}', false);
