-- Harga pasar dibaca dari ai/harga/output/prediksi.json; snapshot di database tidak dipakai.

drop view public.market_prices_latest;
alter table public.patungans drop column commodity_slug;
drop table public.market_price_snapshots;
drop table public.market_commodities;
