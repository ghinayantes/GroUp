import type { Metadata } from "next";
import Catalog from "@/components/site/Catalog";
import PageHero from "@/components/site/PageHero";
import type { Batch } from "@/lib/batch";
import { parseCatalogFilters, type SearchParams } from "@/lib/catalog";
import { listOpenBatches } from "@/lib/orders";

export const metadata: Metadata = { title: "Semua patungan — GroUp" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<SearchParams> };

export default async function CatalogPage({ searchParams }: Props) {
  const params = await searchParams;
  let batches: Batch[] = [];
  let loadError = "";
  try {
    batches = await listOpenBatches();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Daftar batch tidak dapat dimuat.";
  }
  const initial = parseCatalogFilters(params);

  return <main>
    <PageHero crumbs={[{ label: "Patungan" }]} title={<>Semua <em>patungan</em> terbuka</>} description="Pilih batch bahan baku, bandingkan tier harga dan progres kuota, lalu gabung sebelum deadline." />
    <section className="section">
      {loadError && <p className="form-error">{loadError}</p>}
      <Catalog key={JSON.stringify(initial)} batches={batches} initial={initial} whatsappNumber={process.env.NEXT_PUBLIC_WHATSAPP_NUMBER} />
    </section>
  </main>;
}
