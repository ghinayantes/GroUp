import type { Metadata } from "next";
import Link from "next/link";
import Faq from "@/components/site/Faq";
import Icon from "@/components/site/Icon";
import PageHero from "@/components/site/PageHero";
import TierSimulator from "@/components/site/TierSimulator";
import { photo } from "@/lib/batch";

export const metadata: Metadata = { title: "Cara kerja patungan — GroUp" };

const steps = [
  { icon: "search" as const, title: "Pilih batch yang terbuka", body: "Setiap batch berisi satu bahan baku dari satu supplier. Sebelum ikut, kamu bisa melihat kuota minimum, tier harga, deadline, aturan pembayaran, dan rencana penyerahan." },
  { icon: "chat" as const, title: "Pesan lewat website atau WhatsApp", body: "Isi nama usaha, nomor WhatsApp, dan jumlah. Lewat WhatsApp, kirim MULAI lalu pilih batch dari menu. Kedua jalur menambah progres batch yang sama." },
  { icon: "chart" as const, title: "Kuota terkumpul sampai deadline", body: "Selama batch terbuka, pesanan bisa diubah atau dibatalkan. Makin banyak yang ikut, makin tinggi tier harga yang bisa dicapai." },
  { icon: "check" as const, title: "Batch ditutup", body: "Jika total mencapai kuota minimum, harga final dikunci dari tier tertinggi yang tercapai. Jika tidak, batch tidak diproses dan tidak ada tagihan." },
  { icon: "truck" as const, title: "Bayar & terima barang", body: "Pengelola menghubungi peserta untuk pembayaran sesuai aturan batch, lalu barang diserahkan sesuai rencana penyerahan (ambil di titik kumpul atau diantar)." },
];

const faqs = [
  { q: "Kapan saya harus membayar?", a: "Hanya setelah batch berhasil ditutup dan harga final diketahui. Tidak ada pembayaran saat memesan." },
  { q: "Bagaimana jika kuota minimum tidak tercapai?", a: "Batch ditutup sebagai tidak tercapai. Pesananmu disimpan sebagai riwayat, tanpa tagihan dan tanpa pengiriman." },
  { q: "Bisakah saya mengubah atau membatalkan pesanan?", a: <>Bisa, selama batch masih terbuka. Pesanan website memakai kode pengelolaan di halaman <Link href="/pesanan">Kelola pesanan</Link>. Pesanan WhatsApp dikelola dengan mengirim <b>PESANAN</b> dari nomor yang sama.</> },
  { q: "Bagaimana harga final ditentukan?", a: "Setiap batch punya beberapa ambang kuantitas. Harga final memakai tier tertinggi yang tercapai oleh total semua pesanan saat batch ditutup, dan berlaku sama untuk semua peserta." },
  { q: "Apa arti supplier terverifikasi?", a: "Pengelola sudah memeriksa supplier secara manual (misalnya legalitas usaha dan contoh barang). Kami juga menampilkan jumlah batch yang sudah selesai, bukan skor rating." },
  { q: "Apakah ada pengiriman?", a: "Setiap batch punya satu rencana penyerahan yang ditetapkan pengelola, misalnya ambil di titik kumpul atau diantar dalam area tertentu. Logistik diatur di luar aplikasi." },
];

export default function HowItWorksPage() {
  return <main>
    <PageHero crumbs={[{ label: "Cara kerja" }]} title={<>Belanja bareng, <em>bayar setelah berhasil</em></>} description="Patungan per batch membuat usaha kecil bisa membeli bahan baku di harga grosir tanpa harus membeli dalam jumlah besar sendiri." image={photo("photo-1506617564039-2f3b650b7010", 900)} />

    <section className="section">
      <div className="section-head"><div><span className="eyebrow">Alur</span><h2>Lima langkah patungan</h2></div></div>
      <ol className="timeline">
        {steps.map((step, index) => <li key={step.title}>
          <span className="timeline-icon"><Icon name={step.icon} size={22} /></span>
          <div><small>Langkah {index + 1}</small><h3>{step.title}</h3><p>{step.body}</p></div>
        </li>)}
      </ol>
    </section>

    <section className="band" id="simulasi">
      <div className="section">
        <div className="section-head"><div><span className="eyebrow">Simulasi</span><h2>Lihat bagaimana <em>harga bertingkat</em> bekerja</h2></div></div>
        <TierSimulator />
      </div>
    </section>

    <section className="section info-grid">
      <article className="info-card">
        <span className="info-icon"><Icon name="chat" /></span>
        <h3>Perintah WhatsApp</h3>
        <dl className="command-list">
          <dt>MULAI</dt><dd>Tampilkan batch terbuka dan mulai memesan</dd>
          <dt>PESANAN</dt><dd>Lihat pesanan aktif dari nomormu</dd>
          <dt>UBAH &lt;kode&gt; &lt;jumlah&gt;</dt><dd>Ubah jumlah selama batch terbuka</dd>
          <dt>BATAL &lt;kode&gt;</dt><dd>Batalkan pesanan selama batch terbuka</dd>
        </dl>
      </article>
      <article className="info-card">
        <span className="info-icon"><Icon name="shield" /></span>
        <h3>Yang kami jaga</h3>
        <ul className="check-list">
          <li>Tidak ada dana terkumpul untuk batch yang gagal</li>
          <li>Harga final sama untuk semua peserta batch</li>
          <li>Status pembayaran dan penyerahan tercatat per pesanan</li>
          <li>Nomor telepon hanya dipakai untuk menjalankan patungan</li>
        </ul>
      </article>
    </section>

    <section className="section" id="faq">
      <div className="section-head"><div><span className="eyebrow">FAQ</span><h2>Pertanyaan umum</h2></div></div>
      <Faq items={faqs} />
    </section>

    <section className="section">
      <div className="cta-banner"><div><h2>Siap ikut batch minggu ini?</h2><p>Lihat batch yang terbuka dan gabung sebelum deadline.</p></div><Link href="/patungan" className="button button-light">Lihat patungan <Icon name="arrow" size={16} /></Link></div>
    </section>
  </main>;
}
