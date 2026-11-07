import { daysLeft, formatQuantity, resolveTiers, rupiah, type Batch } from "@/lib/batch";
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
        {loadError && <p className="form-error">{loadError}</p>}
        {!loadError && batches.length === 0 && <div className="empty-state"><h3>Belum ada batch terbuka</h3><p>Batch baru dibuka setiap awal minggu. Coba lagi nanti.</p></div>}
        <div className="product-grid">
          {batches.map((batch) => {
            const { current, next } = resolveTiers(batch);
            const percent = Math.min(100, Math.round((batch.current / batch.minimum) * 100));
            return <article key={batch.id} className="product-card">
              <div className="product-image" style={{ backgroundColor: batch.color }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- foto contoh dari CDN */}
                {batch.image && <img src={batch.image} alt={batch.name} loading="lazy" />}
              </div>
              <div className="product-content">
                <div className="product-meta"><span>{batch.category}</span><span className="days">{daysLeft(batch.closesAt)} hari lagi</span></div>
                <h3>{batch.name}</h3>
                <div className="supplier-line"><span>{batch.supplier}</span></div>
                <div className="price-row">
                  <div className="price">{rupiah(current?.unitPrice ?? 0)}<span>/{batch.unit}</span></div>
                  {next && <div className="next-price">turun ke <b>{rupiah(next.unitPrice)}</b> di {formatQuantity(next.minQuantity)} {batch.unit}</div>}
                </div>
                <div className="card-progress">
                  <div className="progress-caption"><span><b>{formatQuantity(batch.current)}</b> / {formatQuantity(batch.minimum)} {batch.unit}</span><span>{percent}%</span></div>
                </div>
              </div>
            </article>;
          })}
        </div>
      </div>
    </section>
  </main>;
}
