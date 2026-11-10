import Link from "next/link";
import { DashHeader, StatTile } from "@/components/dashboard/Shell";
import { STAGE_LABEL, summarizeTraces } from "@/lib/ai-activity";
import { requireRole } from "@/lib/auth";
import { listRecentTraces } from "@/lib/dashboard-data";

const time = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const number = new Intl.NumberFormat("id-ID");

export default async function AiActivity() {
  await requireRole("admin");
  const traces = await listRecentTraces();
  const summary = summarizeTraces(traces);
  return <>
    <DashHeader eyebrow="AKTIVITAS AI · 30 HARI" title="Bagaimana agen menjawab">
      Setiap pesan WhatsApp dan simulator dicatat sebagai trace teknis: jalur yang dipakai, intent, aksi, tools, dan latensi. Isi pesan tidak disimpan di trace. <Link href="/transparansi-ai" className="text-link">Transparansi AI</Link>
    </DashHeader>
    <div className="stat-grid">
      <StatTile label="Pesan" value={number.format(summary.total)} />
      <StatTile label="Panggilan LLM" value={number.format(summary.llmCalls)} hint={summary.total ? `${Math.round((summary.llmCalls / summary.total) * 100)}% dari pesan` : undefined} />
      <StatTile label="Token masuk / keluar" value={`${number.format(summary.inputTokens)} / ${number.format(summary.outputTokens)}`} />
      <StatTile label="Perkiraan biaya" value={`$${summary.estimatedCostUsd.toFixed(4)}`} hint={`Bila memakai ${summary.comparisonModel} berbayar (harga dicek ${summary.pricingCheckedAt}); tier gratis = $0`} />
    </div>
    <section className="dash-card">
      <h2>Pesan per jalur</h2>
      <div className="stage-bars">
        {summary.byStage.map((item) => <div key={item.stage} className="stage-bar">
          <span>{STAGE_LABEL[item.stage]} <code>{item.stage}</code></span>
          <div className="progress-track"><span style={{ width: `${item.pct}%` }} /></div>
          <b>{number.format(item.count)} · {item.pct.toLocaleString("id-ID")}%</b>
        </div>)}
      </div>
      {summary.medianLatencyMs !== null && <p className="admin-message">Median latensi {number.format(summary.medianLatencyMs)} ms.</p>}
    </section>
    <section className="dash-card">
      <h2>Trace terbaru</h2>
      {traces.length === 0 ? <p className="admin-message">Belum ada trace.</p> : <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Waktu</th><th>Kanal</th><th>Jalur</th><th>Intent</th><th>Aksi</th><th>Tools</th><th>Latensi</th></tr></thead>
        <tbody>{traces.slice(0, 50).map((trace) => <tr key={trace.id}>
          <td>{time.format(new Date(trace.created_at))}</td>
          <td>{trace.channel}</td>
          <td><span className="pill">{trace.stage}</span>{trace.model && <small>{trace.model}</small>}</td>
          <td>{trace.intent ?? "—"}{trace.confidence !== null && <small>confidence {Number(trace.confidence).toFixed(2)}</small>}</td>
          <td>{trace.action}</td>
          <td>{trace.tools?.length ? trace.tools.join(", ") : "—"}</td>
          <td>{number.format(trace.latency_ms)} ms</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </>;
}
