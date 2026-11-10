import CreateBatchForm from "@/components/dashboard/CreateBatchForm";
import { DashHeader } from "@/components/dashboard/Shell";
import { requireRole } from "@/lib/auth";
import { supplierForOwner } from "@/lib/dashboard-data";

export default async function GrosirCreateBatch() {
  const user = await requireRole("grosir");
  const supplier = await supplierForOwner(user.id);
  return <>
    <DashHeader eyebrow="BUKA BATCH" title="Buka patungan baru">
      Satu bahan baku per batch. Harga final memakai tier tertinggi yang tercapai saat batch ditutup.
    </DashHeader>
    <section className="dash-card">
      {supplier ? <CreateBatchForm endpoint="/api/grosir/patungans" /> : <p className="admin-message">Akun ini belum dihubungkan ke supplier.</p>}
    </section>
  </>;
}
