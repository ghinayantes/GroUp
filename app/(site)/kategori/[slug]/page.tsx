import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Catalog from "@/components/site/Catalog";
import PageHero from "@/components/site/PageHero";
import { categorySlug, summarizeCategories, type Batch } from "@/lib/batch";
import { parseCatalogFilters, type SearchParams } from "@/lib/catalog";
import { listOpenBatches } from "@/lib/orders";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

async function load(slug: string) {
  let batches: Batch[] = [];
  try {
    batches = await listOpenBatches();
  } catch {
    batches = [];
  }
  const category = summarizeCategories(batches).find((item) => item.slug === slug);
  return { category, batches: batches.filter((batch) => categorySlug(batch.category) === slug) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await load((await params).slug);
  return { title: category ? `${category.name} — Kategori GroUp` : "Kategori tidak ditemukan — GroUp" };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const { category, batches } = await load(slug);
  if (!category) notFound();
  const initial = parseCatalogFilters(query, slug);
  return <main>
    <PageHero crumbs={[{ href: "/kategori", label: "Kategori" }, { label: category.name }]} title={category.name} description={`${category.count} batch ${category.name.toLowerCase()} sedang terbuka. Harga final mengikuti tier tertinggi yang tercapai saat batch ditutup.`} image={category.image || undefined} />
    <section className="section">
      <Catalog key={JSON.stringify(initial)} batches={batches} initial={initial} lockedCategory={slug} whatsappNumber={process.env.NEXT_PUBLIC_WHATSAPP_NUMBER} />
    </section>
  </main>;
}
