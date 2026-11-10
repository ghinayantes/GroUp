-- Cache ringkasan kepercayaan supplier: dibuat ulang bila lebih tua dari 24 jam atau hash faktanya berubah.
alter table public.suppliers
  add column trust_summary text check (trust_summary is null or length(trust_summary) <= 600),
  add column trust_summary_at timestamptz,
  add column trust_facts_hash text;
