import AiLabel from "@/components/trust/AiLabel";
import { rupiah } from "@/lib/batch";
import { fairPriceLabel, fairPriceSource, forecastLabel, type FairPrice } from "@/lib/trust/fair-price";

const tone = (fair: FairPrice) => (fair.savingPct > 0 ? "fair-save" : fair.savingPct < 0 ? "fair-more" : "fair-even");

export function FairPriceBadge({ fair }: { fair: FairPrice }) {
  return <p className={`fair-badge ${tone(fair)}`} title={`Harga pasar ${rupiah(fair.marketPrice)}/${fair.unit} (${fairPriceSource(fair)})`}>
    {fairPriceLabel(fair)} <small>({fairPriceSource(fair)})</small>
  </p>;
}

export function FairPricePanel({ fair }: { fair: FairPrice }) {
  return <section className={`fair-panel ${tone(fair)}`} aria-labelledby="fair-title">
    <div className="fair-head"><h2 id="fair-title">Cek harga wajar</h2><AiLabel /></div>
    <p className="fair-main"><b>{fairPriceLabel(fair)}</b>: patungan {rupiah(fair.batchPrice)}/{fair.unit} vs pasar {rupiah(fair.marketPrice)}/{fair.unit}.{fair.bestPrice !== null && <> Bisa turun ke {rupiah(fair.bestPrice)} bila tier terbaik tercapai.</>}</p>
    {fair.forecast && <p>{forecastLabel(fair.forecast)}</p>}
    <small>Sumber: {fairPriceSource(fair)}.{fair.forecast && ` Prediksi model ${fair.forecast.model}${fair.forecast.validationMape !== null ? `, galat validasi ${fair.forecast.validationMape.toLocaleString("id-ID")}%` : ""}; data bulanan, bukan harian.`}</small>
  </section>;
}
