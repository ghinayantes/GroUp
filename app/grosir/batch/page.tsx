import BatchList from "@/components/dashboard/BatchList";
import { DashHeader } from "@/components/dashboard/Shell";
import { requireRole } from "@/lib/auth";
import { listBatches, supplierForOwner } from "@/lib/dashboard-data";

export default async function GrosirBatches() {
  const user = await requireRole("grosir");
  const supplier = await supplierForOwner(user.id);
  return <>
    <DashHeader eyebrow="BATCH SAYA" title="Batch & pesanan">
      Tutup batch setelah deadline. Pembayaran dan penyerahan dicatat oleh admin GroUp.
    </DashHeader>
    <section className="dash-card">
      {supplier ? <BatchList batches={await listBatches(supplier.id)} mode="grosir" /> : <p className="admin-message">Akun ini belum dihubungkan ke supplier.</p>}
    </section>
  </>;
}
