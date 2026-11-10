import Link from "next/link";
import { DashHeader, StatTile } from "@/components/dashboard/Shell";
import { requireRole } from "@/lib/auth";
import { formatQuantity } from "@/lib/batch";
import { listBatches, supplierForOwner } from "@/lib/dashboard-data";

export default async function GrosirHome() {
  const user = await requireRole("grosir");
  const supplier = await supplierForOwner(user.id);
  if (!supplier) return <><DashHeader eyebrow="RINGKASAN" title="Akun belum terhubung" /><p className="dash-card">Akun ini belum dihubungkan ke supplier. Minta admin GroUp menghubungkannya di halaman Verifikasi supplier.</p></>;
  const batches = await listBatches(supplier.id);
  const active = batches.filter((batch) => batch.status === "open" && !batch.expired);
  return <>
    <DashHeader eyebrow="RINGKASAN" title={supplier.name} />
    <div className="stat-grid">
      <StatTile label="Batch aktif" value={active.length} />
      <StatTile label="Batch selesai" value={supplier.completedBatches} />
      <StatTile label="Perlu ditutup" value={batches.filter((batch) => batch.expired).length} />
      <StatTile label="Status" value={supplier.verified ? "Terverifikasi" : "Belum terverifikasi"} />
    </div>
    <section className="dash-card">
      <div className="dash-card-head"><h2>Progres kuota</h2><Link href="/grosir/buka-batch" className="text-link">Buka batch baru</Link></div>
      {active.length === 0 ? <p className="admin-message">Belum ada batch aktif.</p> : <div className="stage-bars">
        {active.map((batch) => {
          const percent = Math.min(100, Math.round((batch.committed / batch.minimum) * 100));
          return <div key={batch.id} className="stage-bar">
            <span>{batch.name}</span>
            <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
            <b>{formatQuantity(batch.committed)} / {formatQuantity(batch.minimum)} {batch.unit}</b>
          </div>;
        })}
      </div>}
    </section>
  </>;
}
