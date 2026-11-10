import Link from "next/link";
import { DashHeader } from "@/components/dashboard/Shell";
import AiLabel from "@/components/trust/AiLabel";
import { requireRole } from "@/lib/auth";
import { formatQuantity, rupiah } from "@/lib/batch";
import { ceil10, MIN_SENDERS, type RadarEntry, type UnitQuantity } from "@/lib/trust/demand-radar";
import { loadDemandRadar } from "@/lib/trust/demand-radar-data";
import { forecastLabel, formatObservedAt } from "@/lib/trust/fair-price";

const quantities = (list: UnitQuantity[]) => list.map((item) => `${formatQuantity(item.quantity)} ${item.unit}`).join(" · ");

function openBatchHref(entry: RadarEntry) {
  const unit = entry.market?.unit ?? entry.weekly[0]?.unit ?? entry.once[0]?.unit ?? "kg";
  const weekly = entry.weekly.find((item) => item.unit === unit)?.quantity ?? 0;
  const params = new URLSearchParams({ nama: entry.name, satuan: unit });
  if (weekly > 0) params.set("kuota", String(ceil10(weekly)));
  return `/grosir/buka-batch?${params}`;
}

function trendLabel({ recent, previous }: RadarEntry["trend"]) {
  if (recent > previous) return `Naik: ${recent} pengirim dalam 14 hari terakhir vs ${previous} sebelumnya`;
  if (recent < previous) return `Turun: ${recent} pengirim dalam 14 hari terakhir vs ${previous} sebelumnya`;
  return `Stabil: ${recent} pengirim dalam 14 hari terakhir`;
}

export default async function DemandRadarPage() {
  await requireRole("grosir");
  const radar = await loadDemandRadar();
  return <>
    <DashHeader eyebrow="RADAR PERMINTAAN" title="Apa yang dicari UMKM">
      Dikumpulkan agen AI dari pesan WhatsApp dan simulator saat pembeli mencari bahan yang belum ada batch-nya. Nama bahan dicocokkan otomatis; bahan dengan kurang dari {MIN_SENDERS} pengirim tidak ditampilkan. <AiLabel />
    </DashHeader>
    {radar.length === 0 ? <section className="dash-card"><p className="admin-message">Belum ada sinyal permintaan yang cukup.</p></section> : <div className="radar-grid">
      {radar.map((entry) => <article key={entry.name} className="dash-card radar-card">
        <div className="dash-card-head"><h2>{entry.name}</h2><span className="pill">{entry.senders} pengirim</span></div>
        <dl className="detail-rules">
          <dt>Per minggu</dt><dd>{entry.weekly.length ? `± ${quantities(entry.weekly)}` : "—"}</dd>
          {entry.once.length > 0 && <><dt>Sekali beli</dt><dd>{quantities(entry.once)}</dd></>}
          <dt>Tren</dt><dd>{trendLabel(entry.trend)}</dd>
          {entry.market && <><dt>Harga pasar</dt><dd>{rupiah(entry.market.pricePerUnit)}/{entry.market.unit} ({entry.market.source} {entry.market.region}, {formatObservedAt(entry.market.observedAt)}){entry.market.forecast && <small>{forecastLabel(entry.market.forecast)}</small>}</dd></>}
        </dl>
        <Link href={openBatchHref(entry)} className="button button-dark">Buka batch dari sinyal ini</Link>
      </article>)}
    </div>}
  </>;
}
