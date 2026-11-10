import Link from "next/link";
import BuyerOrderCard from "@/components/dashboard/BuyerOrderCard";
import { DashHeader } from "@/components/dashboard/Shell";
import { requireRole } from "@/lib/auth";
import { listOrdersForBuyer } from "@/lib/orders";

export default async function BuyerOrders() {
  const user = await requireRole("pembeli");
  const orders = await listOrdersForBuyer(user.id);
  return <>
    <DashHeader eyebrow="PESANAN SAYA" title="Pesanan patungan">Jumlah bisa diubah atau dibatalkan selama batch masih terbuka.</DashHeader>
    {orders.length === 0
      ? <section className="dash-card"><p className="admin-message">Belum ada pesanan. <Link href="/patungan" className="text-link">Cari batch terbuka</Link></p></section>
      : <div className="admin-batches">{orders.map((order) => <BuyerOrderCard key={order.id} order={order} />)}</div>}
  </>;
}
