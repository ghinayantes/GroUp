import { daysLeft, formatQuantity, resolveTiers, rupiah } from "@/lib/batch";
import { demoBatches } from "@/lib/demo-data";

export default function Home() {
  return <main>
    <section className="band">
      <div className="section">
        <div className="section-head">
          <div><span className="eyebrow">Patungan</span><h2>Batch <em>minggu ini</em></h2></div>
        </div>
        <div className="product-grid">
          {demoBatches.map((batch) => {
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
