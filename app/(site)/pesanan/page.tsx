import type { Metadata } from "next";
import ManageOrder from "@/components/ManageOrder";
import PageHero from "@/components/site/PageHero";

export const metadata: Metadata = { title: "Kelola pesanan — GroUp" };

export default function ManageOrderPage() {
  return <main>
    <PageHero crumbs={[{ label: "Kelola pesanan" }]} title={<>Kelola <em>pesananmu</em></>} description="Cek status, ubah jumlah, atau batalkan pesanan selama batch masih terbuka." />
    <section className="section"><ManageOrder /></section>
  </main>;
}
