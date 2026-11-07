import type { Metadata } from "next";
import Faq from "@/components/site/Faq";
import Icon from "@/components/site/Icon";
import PageHero from "@/components/site/PageHero";
import { photo } from "@/lib/batch";

export const metadata: Metadata = { title: "Untuk supplier — GroUp" };

const email = "mitra@group.id";
const mailto = `mailto:${email}?subject=${encodeURIComponent("Pendaftaran mitra supplier GroUp")}&body=${encodeURIComponent(
  "Nama usaha:\nNama kontak & nomor WhatsApp:\nAlamat gudang/lokasi:\nBahan baku yang ditawarkan:\nKapasitas per minggu:\nKisaran harga grosir & ambang kuantitas:\nOpsi penyerahan (ambil/antar, area):\nLegalitas (NIB/PIRT/izin lain):\n",
)}`;

const benefits = [
  { icon: "chart" as const, title: "Permintaan sudah terkumpul", body: "Pesanan dari banyak usaha mikro digabung per batch, jadi kamu menerima satu pesanan dengan volume jelas." },
  { icon: "clock" as const, title: "Jadwal yang bisa diprediksi", body: "Batch dibuka mingguan dengan deadline tetap. Kamu tahu kapan pesanan ditutup dan kapan barang perlu siap." },
  { icon: "check" as const, title: "Hanya batch yang berhasil", body: "Batch diproses hanya jika kuota minimum tercapai, pada tier harga yang sudah kamu sepakati." },
  { icon: "store" as const, title: "Dikenal oleh usaha lokal", body: "Nama usaha, status verifikasi, dan riwayat batch selesai tampil di setiap batch yang kamu pasok." },
];

const process = [
  { title: "Kenalan", body: "Kirim profil usaha dan bahan yang ditawarkan lewat email." },
  { title: "Verifikasi manual", body: "Pengelola memeriksa legalitas, contoh barang, dan lokasi penyerahan." },
  { title: "Sepakati batch", body: "Tentukan kuota minimum, tier harga, jadwal, dan rencana penyerahan." },
  { title: "Batch dibuka", body: "Usaha mikro bergabung lewat website atau WhatsApp sampai deadline." },
  { title: "Pemenuhan", body: "Batch berhasil ditutup, kamu menyiapkan barang sesuai rencana penyerahan." },
];

const faqs = [
  { q: "Apakah ada biaya untuk menjadi mitra?", a: "Skema kerja sama dibahas saat perkenalan. Tidak ada biaya pendaftaran di website ini." },
  { q: "Siapa yang menentukan harga?", a: "Tier harga disepakati bersama pengelola sebelum batch dibuka. Pembeli melihat semua tier sejak awal." },
  { q: "Bagaimana jika batch tidak mencapai minimum?", a: "Batch ditutup tanpa pesanan ke supplier. Kamu tidak perlu menyiapkan barang." },
  { q: "Bagaimana pembayaran ke supplier?", a: "Pembayaran dan logistik saat ini diatur langsung bersama pengelola di luar aplikasi." },
];

export default function SupplierPage() {
  return <main>
    <PageHero tone="green" crumbs={[{ label: "Untuk supplier" }]} title={<>Pasok bahan baku ke <em>banyak usaha</em> sekaligus</>} description="GroUp mengumpulkan kebutuhan usaha mikro per batch, sehingga supplier menerima pesanan gabungan dengan kuota, harga, dan jadwal yang jelas." image={photo("photo-1542838132-92c53300491e", 900)}>
      <div className="hero-actions"><a href={mailto} className="button button-dark">Daftar jadi mitra <Icon name="arrow" size={16} /></a><a href="#proses" className="text-link">Lihat prosesnya</a></div>
    </PageHero>

    <section className="section">
      <div className="section-head"><div><span className="eyebrow">Keuntungan</span><h2>Kenapa bermitra dengan GroUp</h2></div></div>
      <div className="benefit-grid">
        {benefits.map((item) => <article key={item.title} className="info-card"><span className="info-icon"><Icon name={item.icon} /></span><h3>{item.title}</h3><p>{item.body}</p></article>)}
      </div>
    </section>

    <section className="band" id="proses">
      <div className="section">
        <div className="section-head"><div><span className="eyebrow">Proses</span><h2>Dari kenalan sampai <em>pemenuhan</em></h2></div></div>
        <ol className="process-list">
          {process.map((step) => <li key={step.title}><b>{step.title}</b><span>{step.body}</span></li>)}
        </ol>
      </div>
    </section>

    <section className="section info-grid">
      <article className="info-card">
        <span className="info-icon"><Icon name="shield" /></span>
        <h3>Yang kami periksa saat verifikasi</h3>
        <ul className="check-list">
          <li>Legalitas usaha (misalnya NIB atau izin yang relevan)</li>
          <li>Contoh barang dan konsistensi kualitas</li>
          <li>Kapasitas pasokan per minggu</li>
          <li>Lokasi dan opsi penyerahan barang</li>
        </ul>
      </article>
      <article className="info-card">
        <span className="info-icon"><Icon name="bag" /></span>
        <h3>Siapkan informasi ini</h3>
        <ul className="check-list">
          <li>Bahan baku dan satuan jual</li>
          <li>Harga grosir untuk beberapa ambang kuantitas</li>
          <li>Kuota minimum agar batch layak diproses</li>
          <li>Jadwal siap kirim atau ambil</li>
        </ul>
      </article>
    </section>

    <section className="section">
      <div className="section-head"><div><span className="eyebrow">FAQ</span><h2>Pertanyaan supplier</h2></div></div>
      <Faq items={faqs} />
    </section>

    <section className="section">
      <div className="cta-banner"><div><h2>Siap memasok batch berikutnya?</h2><p>Kirim profil usahamu ke {email}. Template email sudah kami siapkan.</p></div><a href={mailto} className="button button-light">Kirim email pendaftaran <Icon name="arrow" size={16} /></a></div>
    </section>
  </main>;
}
