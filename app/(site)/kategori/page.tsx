import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/site/Icon";
import PageHero from "@/components/site/PageHero";
import { formatQuantity, percentOf, summarizeCategories, type Batch } from "@/lib/batch";
import { listOpenBatches } from "@/lib/orders";

export const metadata: Metadata = { title: "Kategori bahan — GroUp" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  let batches: Batch[] = [];
  try {
    batches = await listOpenBatches();
  } catch {
    batches = [];
  }
  const categories = summarizeCategories(batches);
  return <main>
    <PageHero crumbs={[{ label: "Kategori" }]} title={<>Kategori <em>bahan baku</em></>} description="Setiap batch berisi satu jenis bahan baku. Pilih kategori untuk melihat batch yang sedang terbuka." />
    <section className="section">
      {categories.length === 0 ? <div className="empty-state"><span><Icon name="search" size={34} /></span><h3>Belum ada kategori</h3><p>Kategori muncul saat pengelola membuka batch baru.</p></div> :
      <div className="category-cards">
        {categories.map((category) => {
          const items = batches.filter((batch) => batch.category === category.name);
          return <Link key={category.slug} href={`/kategori/${category.slug}`} className="category-card">
            <span className="category-card-image">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL gambar dari admin */}
              {category.image && <img src={category.image} alt="" loading="lazy" />}
            </span>
            <span className="category-card-body">
              <span className="category-card-title"><b>{category.name}</b><small>{category.count} batch terbuka</small></span>
              <span className="category-card-list">
                {items.slice(0, 3).map((batch) => <span key={batch.id}><span>{batch.name}</span><small>{formatQuantity(batch.current)}/{formatQuantity(batch.minimum)} {batch.unit} · {percentOf(batch)}%</small></span>)}
              </span>
              <span className="text-link">Lihat kategori <Icon name="arrow" size={14} /></span>
            </span>
          </Link>;
        })}
      </div>}
    </section>
  </main>;
}
