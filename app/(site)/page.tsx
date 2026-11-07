import BatchGrid from "@/components/site/BatchGrid";
import Icon from "@/components/site/Icon";
import type { Batch } from "@/lib/batch";
import { listOpenBatches } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function Home() {
  let batches: Batch[] = [];
  let loadError = "";
  try {
    batches = await listOpenBatches();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Daftar batch tidak dapat dimuat.";
  }

  return <main>
    <section className="band">
      <div className="section">
        <div className="section-head">
          <div><span className="eyebrow">Patungan</span><h2>Batch <em>minggu ini</em></h2></div>
        </div>
        {batches.length > 0
          ? <BatchGrid batches={batches} whatsappNumber={process.env.NEXT_PUBLIC_WHATSAPP_NUMBER} />
          : <div className="empty-state"><span><Icon name="search" size={34} /></span><h3>{loadError ? "Batch belum dapat dimuat" : "Belum ada batch terbuka"}</h3><p>{loadError || "Batch baru dibuka setiap awal minggu. Coba lagi nanti."}</p></div>}
      </div>
    </section>
  </main>;
}
