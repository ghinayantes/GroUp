import Link from "next/link";
import { DashHeader, StatTile } from "@/components/dashboard/Shell";
import { STAGE_LABEL, summarizeTraces } from "@/lib/ai-activity";
import { requireRole } from "@/lib/auth";
import { rupiah } from "@/lib/batch";
import { batchKpis, listBatches, listRecentTraces } from "@/lib/dashboard-data";

export default async function AdminHome() {
  await requireRole("admin");
  const [batches, traces] = await Promise.all([listBatches(), listRecentTraces()]);
  const kpis = batchKpis(batches);
  const summary = summarizeTraces(traces);
  return <>
    <DashHeader eyebrow="RINGKASAN" title="Kondisi GroUp hari ini" />
    <div className="stat-grid">
      <StatTile label="Batch aktif" value={kpis.activeBatches} />
      <StatTile label="Pesanan di batch terbuka" value={kpis.activeOrders} />
      <StatTile label="Nilai transaksi" value={rupiah(kpis.transactionValue)} hint="Batch berhasil, dari 50 batch terbaru" />
      <StatTile label="Pesan ke agen (30 hari)" value={summary.total} />
    </div>
    <section className="dash-card">
      <div className="dash-card-head"><h2>Pembagian pesan per jalur agen</h2><Link href="/admin/aktivitas-ai" className="text-link">Lihat aktivitas AI</Link></div>
      {summary.total === 0 ? <p className="admin-message">Belum ada pesan ke agen dalam 30 hari terakhir.</p> : <div className="stage-bars">
        {summary.byStage.map((item) => <div key={item.stage} className="stage-bar">
          <span>{STAGE_LABEL[item.stage]}</span>
          <div className="progress-track"><span style={{ width: `${item.pct}%` }} /></div>
          <b>{item.count} · {item.pct.toLocaleString("id-ID")}%</b>
        </div>)}
      </div>}
    </section>
  </>;
}
