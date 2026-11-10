import BatchList from "@/components/dashboard/BatchList";
import CreateBatchForm from "@/components/dashboard/CreateBatchForm";
import { DashHeader } from "@/components/dashboard/Shell";
import SimulatorPurge from "@/components/dashboard/SimulatorPurge";
import { requireRole } from "@/lib/auth";
import { listBatches, listSuppliers } from "@/lib/dashboard-data";

export default async function AdminBatches() {
  await requireRole("admin");
  const [batches, suppliers] = await Promise.all([listBatches(), listSuppliers()]);
  return <>
    <DashHeader eyebrow="PENGELOLAAN BATCH" title="Batch & pesanan">
      Pesanan dari website, WhatsApp, dan simulator masuk ke daftar yang sama. Setelah deadline, tutup batch: di bawah minimum batch tidak diproses; jika tercapai, harga final dibekukan lalu pembayaran dan penyerahan dicatat manual.
    </DashHeader>
    <section className="dash-card">
      <SimulatorPurge batches={batches} />
      <BatchList batches={batches} mode="admin" />
    </section>
    <section className="dash-card">
      <h2>Buka patungan</h2>
      <p className="admin-message">Satu bahan baku per batch. Harga final memakai tier tertinggi yang tercapai saat batch ditutup.</p>
      <CreateBatchForm endpoint="/api/admin/patungans" suppliers={suppliers} />
    </section>
  </>;
}
