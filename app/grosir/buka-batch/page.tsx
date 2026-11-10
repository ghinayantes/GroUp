import CreateBatchForm, { type BatchDraft } from "@/components/dashboard/CreateBatchForm";
import { DashHeader } from "@/components/dashboard/Shell";
import { requireRole } from "@/lib/auth";
import { supplierForOwner } from "@/lib/dashboard-data";
import { loadDemandRadar } from "@/lib/trust/demand-radar-data";

type Props = { searchParams: Promise<{ nama?: string; satuan?: string; kuota?: string }> };

/** nama, satuan, dan kuota terisi dari tombol "Buka batch dari sinyal ini" di radar. */
function draftFrom({ nama, satuan, kuota }: Awaited<Props["searchParams"]>): Partial<BatchDraft> {
  const minimum = Number(kuota);
  return {
    ...(typeof nama === "string" && nama.trim() ? { name: nama.trim().slice(0, 160) } : {}),
    ...(typeof satuan === "string" && satuan.trim() ? { unit: satuan.trim().slice(0, 20) } : {}),
    ...(Number.isFinite(minimum) && minimum > 0 ? { minimum } : {}),
  };
}

export default async function GrosirCreateBatch({ searchParams }: Props) {
  const user = await requireRole("grosir");
  const [supplier, radar] = await Promise.all([supplierForOwner(user.id), loadDemandRadar()]);
  const initial = draftFrom(await searchParams);
  return <>
    <DashHeader eyebrow="BUKA BATCH" title="Buka patungan baru">
      Satu bahan baku per batch. Harga final memakai tier tertinggi yang tercapai saat batch ditutup. Asisten harga muncul saat nama bahan dan satuan cocok dengan data PIHPS.
    </DashHeader>
    <section className="dash-card">
      {supplier ? <CreateBatchForm key={JSON.stringify(initial)} endpoint="/api/grosir/patungans" initial={initial} radar={radar} /> : <p className="admin-message">Akun ini belum dihubungkan ke supplier.</p>}
    </section>
  </>;
}
