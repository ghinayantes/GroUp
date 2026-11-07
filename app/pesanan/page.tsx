import type { Metadata } from "next";
import ManageOrder from "@/components/ManageOrder";

export const metadata: Metadata = { title: "Kelola pesanan — GroUp" };

export default function ManageOrderPage() {
  return <main className="section">
    <div className="eyebrow eyebrow-dark">KELOLA PESANAN</div>
    <h1>Kelola pesananmu</h1>
    <p>Cek status, ubah jumlah, atau batalkan pesanan selama batch masih terbuka.</p>
    <ManageOrder />
  </main>;
}
