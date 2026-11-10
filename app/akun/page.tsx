import Link from "next/link";
import { DashHeader, StatTile } from "@/components/dashboard/Shell";
import { requireRole } from "@/lib/auth";
import { rupiah } from "@/lib/batch";
import { listOrdersForBuyer } from "@/lib/orders";
import { orderSavings } from "@/lib/trust/fair-price";

export default async function BuyerHome() {
  const user = await requireRole("pembeli");
  const orders = await listOrdersForBuyer(user.id);
  const confirmed = orders.filter((order) => order.status === "confirmed");
  const savings = orderSavings(orders);
  return <>
    <DashHeader eyebrow="RINGKASAN" title="Patungan kamu" />
    <div className="stat-grid">
      {savings.counted > 0 && <StatTile label={savings.total >= 0 ? "Total hemat vs harga pasar" : "Selisih vs harga pasar"} value={rupiah(Math.abs(savings.total))} hint={`${savings.total < 0 ? "Lebih mahal dari pasar. " : ""}Dari ${savings.counted} pesanan dengan data PIHPS Kota Bandung${savings.skipped ? `; ${savings.skipped} pesanan tanpa data pasar tidak dihitung` : ""}.`} />}
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
