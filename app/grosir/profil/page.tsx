import { DashHeader } from "@/components/dashboard/Shell";
import { requireRole } from "@/lib/auth";
import { supplierForOwner } from "@/lib/dashboard-data";

const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

export default async function GrosirProfile() {
  const user = await requireRole("grosir");
  const supplier = await supplierForOwner(user.id);
  return <>
    <DashHeader eyebrow="PROFIL" title={supplier?.name ?? "Profil supplier"}>Ini yang dilihat pembeli tentang supplier kamu.</DashHeader>
    <section className="dash-card">
      {supplier ? <dl className="detail-rules">
        <dt>Status</dt><dd>{supplier.verified ? "Terverifikasi" : "Belum terverifikasi"}</dd>
        <dt>Catatan verifikasi</dt><dd>{supplier.verificationNote || "—"}</dd>
        <dt>Batch selesai</dt><dd>{supplier.completedBatches}</dd>
        <dt>Bergabung</dt><dd>{date.format(new Date(supplier.createdAt))}</dd>
      </dl> : <p className="admin-message">Akun ini belum dihubungkan ke supplier.</p>}
    </section>
  </>;
}
