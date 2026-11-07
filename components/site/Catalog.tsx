"use client";

import { useEffect, useMemo, useState } from "react";
import BatchGrid from "@/components/site/BatchGrid";
import Icon from "@/components/site/Icon";
import { sortLabels, type CatalogFilters, type SortKey } from "@/lib/catalog";
import { categorySlug, daysLeft, percentOf, resolveTiers, summarizeCategories, type Batch } from "@/lib/batch";


/**
 * Katalog patungan: filter kategori, supplier terverifikasi, hampir capai kuota, dan segera tutup.
 * Filter disimpan di URL agar bisa dibagikan.
 */
export default function Catalog({ batches, initial, lockedCategory, whatsappNumber }: {
  batches: Batch[]; initial: CatalogFilters; lockedCategory?: string; whatsappNumber?: string;
}) {
  const [filters, setFilters] = useState(initial);
  const [showFilters, setShowFilters] = useState(false);
  const categories = useMemo(() => summarizeCategories(batches), [batches]);
  const set = <K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) => setFilters((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.kategori && !lockedCategory) params.set("kategori", filters.kategori);
    if (filters.sort !== "deadline") params.set("sort", filters.sort);
    if (filters.verified) params.set("verified", "1");
    if (filters.hampir) params.set("hampir", "1");
    if (filters.segera) params.set("segera", "1");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [filters, lockedCategory]);

  const results = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const list = batches.filter((batch) =>
      (!filters.kategori || categorySlug(batch.category) === filters.kategori) &&
      (!q || `${batch.name} ${batch.supplier} ${batch.category}`.toLowerCase().includes(q)) &&
      (!filters.verified || batch.verified) &&
      (!filters.hampir || percentOf(batch) >= 80) &&
      (!filters.segera || daysLeft(batch.closesAt) <= 3));
    const price = (batch: Batch) => resolveTiers(batch).current?.unitPrice ?? 0;
    return [...list].sort((a, b) =>
      filters.sort === "progres" ? percentOf(b) - percentOf(a)
        : filters.sort === "harga" ? price(a) - price(b)
          : a.closesAt.localeCompare(b.closesAt));
  }, [batches, filters]);

  const activeCount = Number(Boolean(filters.kategori && !lockedCategory)) + Number(filters.verified) + Number(filters.hampir) + Number(filters.segera);
  const reset = () => setFilters({ q: "", kategori: lockedCategory ?? "", sort: "deadline", verified: false, hampir: false, segera: false });

  return <div className="catalog">
    <aside className={showFilters ? "catalog-filters open" : "catalog-filters"} aria-label="Filter">
      <div className="filter-head"><b>Filter</b>{activeCount > 0 && <button className="link-button" onClick={reset}>Hapus semua</button>}</div>
      {!lockedCategory && <fieldset>
        <legend>Kategori</legend>
        <label className="filter-option"><input type="radio" name="kategori" checked={!filters.kategori} onChange={() => set("kategori", "")} /><span>Semua kategori</span><small>{batches.length}</small></label>
        {categories.map((item) => <label key={item.slug} className="filter-option"><input type="radio" name="kategori" checked={filters.kategori === item.slug} onChange={() => set("kategori", item.slug)} /><span>{item.name}</span><small>{item.count}</small></label>)}
      </fieldset>}
      <fieldset>
        <legend>Status batch</legend>
        <label className="filter-option"><input type="checkbox" checked={filters.hampir} onChange={(event) => set("hampir", event.target.checked)} /><span>Hampir capai kuota (≥ 80%)</span></label>
        <label className="filter-option"><input type="checkbox" checked={filters.segera} onChange={(event) => set("segera", event.target.checked)} /><span>Tutup dalam 3 hari</span></label>
      </fieldset>
      <fieldset>
        <legend>Supplier</legend>
        <label className="filter-option"><input type="checkbox" checked={filters.verified} onChange={(event) => set("verified", event.target.checked)} /><span>Hanya supplier terverifikasi</span></label>
      </fieldset>
      <div className="filter-note"><Icon name="shield" size={18} /><span>Verifikasi dilakukan manual oleh pengelola. Kami tidak menampilkan skor rating sebelum ada riwayat cukup.</span></div>
    </aside>

    <div className="catalog-results">
      <div className="catalog-toolbar">
        <label className="catalog-search"><Icon name="search" size={18} /><input value={filters.q} onChange={(event) => set("q", event.target.value)} placeholder="Cari bahan atau supplier" aria-label="Cari bahan atau supplier" /></label>
        <button className="button button-outline filter-toggle" onClick={() => setShowFilters((value) => !value)} aria-expanded={showFilters}><Icon name="filter" size={16} /> Filter{activeCount > 0 && ` (${activeCount})`}</button>
        <label className="catalog-sort"><span>Urutkan</span><select value={filters.sort} onChange={(event) => set("sort", event.target.value as SortKey)}>{(Object.keys(sortLabels) as SortKey[]).map((key) => <option key={key} value={key}>{sortLabels[key]}</option>)}</select></label>
      </div>
      <p className="catalog-count"><b>{results.length}</b> batch {filters.q && <>untuk “{filters.q}”</>}</p>
      {results.length > 0
        ? <BatchGrid batches={results} whatsappNumber={whatsappNumber} columns={3} />
        : <div className="empty-state"><span><Icon name="search" size={34} /></span><h3>{batches.length ? "Tidak ada batch yang cocok" : "Belum ada batch terbuka"}</h3><p>{batches.length ? "Coba ubah kata kunci atau hapus beberapa filter." : "Batch baru dibuka setiap awal minggu."}</p>{batches.length > 0 && <button className="text-link" onClick={reset}>Hapus semua filter</button>}</div>}
    </div>
  </div>;
}
