import Link from "next/link";
import { DashHeader, StatTile } from "@/components/dashboard/Shell";
import { requireRole } from "@/lib/auth";
import { listOrdersForBuyer } from "@/lib/orders";

export default async function BuyerHome() {
  const user = await requireRole("pembeli");
  const orders = await listOrdersForBuyer(user.id);
  const confirmed = orders.filter((order) => order.status === "confirmed");
  return <>
    <DashHeader eyebrow="RINGKASAN" title="Patungan kamu" />
    <div className="stat-grid">
      <StatTile label="Pesanan aktif" value={confirmed.filter((order) => order.batch.status === "open").length} />
      <StatTile label="Menunggu pembayaran" value={confirmed.filter((order) => order.batch.status === "successful" && order.paymentStatus === "due").length} />
      <StatTile label="Batch berhasil" value={confirmed.filter((order) => order.batch.status === "successful").length} />
    </div>
    <section className="dash-card">
      <div className="dash-card-head"><h2>Mau ikut patungan lagi?</h2><Link href="/patungan" className="text-link">Lihat batch terbuka</Link></div>
      <p className="admin-message">Pesanan yang kamu buat saat masuk otomatis tercatat di akun ini. <Link href="/akun/pesanan" className="text-link">Lihat pesanan saya</Link></p>
    </section>
  </>;
}
