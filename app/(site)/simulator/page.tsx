import type { Metadata } from "next";
import Link from "next/link";
import ChatSimulator from "@/components/site/ChatSimulator";
import PageHero from "@/components/site/PageHero";

export const metadata: Metadata = { title: "Coba simulator WhatsApp — GroUp" };

export default function SimulatorPage() {
  return <main>
    <PageHero crumbs={[{ label: "Simulator" }]} title={<>Coba pesan lewat <em>WhatsApp</em> di sini</>} description="Simulator ini memakai agen yang sama dengan nomor WhatsApp GroUp. Kirim MULAI, pilih batch, lalu konfirmasi pesananmu tanpa perlu membuka WhatsApp.">
      <p>Balasan bertanda 🤖 dibantu AI. <Link href="/transparansi-ai">Cara kerjanya</Link></p>
    </PageHero>
    <section className="section">
      <ChatSimulator />
    </section>
  </main>;
}
