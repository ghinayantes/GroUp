import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/site/Icon";
import PageHero from "@/components/site/PageHero";
import { selectStage2Model, type Provider } from "@/lib/agent/model-provider";

export const metadata: Metadata = { title: "Transparansi AI — GroUp" };

const PROVIDER_INFO: Record<Provider, { name: string; retention: React.ReactNode }> = {
  google: {
    name: "Google Gemini API (tier gratis)",
    retention: <>Pada tier gratis, Google dapat menyimpan dan memakai isi permintaan untuk mengembangkan produknya, termasuk ditinjau manusia. Lihat <a href="https://ai.google.dev/gemini-api/terms" rel="noreferrer" target="_blank">ketentuan Gemini API</a>.</>,
  },
  gateway: {
    name: "Vercel AI Gateway",
    retention: <>Permintaan diteruskan ke penyedia model yang dipilih. Penyedia model gratis dapat menyimpan isi permintaan untuk memperbaiki modelnya. Lihat <a href="https://vercel.com/docs/ai-gateway" rel="noreferrer" target="_blank">dokumentasi AI Gateway</a>.</>,
  },
  "openai-compatible": {
    name: "Penyedia model dengan API kompatibel OpenAI",
    retention: "Penyedia dapat menyimpan isi permintaan sesuai kebijakannya masing-masing.",
  },
};

const stages = [
  { icon: "chat" as const, title: "Perintah baku, tanpa AI", body: "MULAI, PESANAN, UBAH, BATAL, dan semua tombol diproses langsung oleh sistem. Tidak ada data yang dikirim ke penyedia model." },
  { icon: "shield" as const, title: "Tahap 1: classifier lokal", body: "Pesan yang jelas dikenali oleh model kecil buatan tim yang berjalan di server GroUp sendiri, tanpa mengirim data keluar. Pesan yang belum jelas diteruskan ke tahap 2." },
  { icon: "search" as const, title: "Tahap 2: model bahasa", body: "Pesan yang rumit atau ambigu dikirim ke penyedia model bahasa. Model hanya boleh membaca data batch, pesananmu sendiri, dan harga pasar. Model tidak bisa menulis data." },
  { icon: "check" as const, title: "Konfirmasi dengan tombol", body: "Usulan AI untuk ikut batch, mengubah, membatalkan, atau mencatat minat selalu muncul sebagai tombol. Tidak ada yang tersimpan sebelum kamu menekan tombol konfirmasi." },
];

const trustFeatures = [
  { title: "Cek harga wajar", body: "Harga patungan dibandingkan dengan harga PIHPS Kota Bandung untuk bahan dan satuan yang sama. Nama bahan dicocokkan otomatis; kalau tidak cocok dengan yakin atau satuannya berbeda, perbandingan tidak ditampilkan. Prediksi bulan depan berasal dari model statistik, dengan nama model dan galat validasinya." },
  { title: "Rekam jejak supplier", body: "Fakta diambil dari database: status verifikasi, batch selesai, persentase batch berhasil, dan pesanan yang sudah diserahkan. Model bahasa hanya menulis ringkasan 1–2 kalimat dari fakta itu. Ringkasan dengan angka atau bulan yang tidak ada di fakta ditolak dan diganti kalimat template. Tabel fakta selalu tampil di sampingnya." },
  { title: "Radar permintaan", body: "Minat yang dicatat agen dari WhatsApp dan simulator dikelompokkan per bahan untuk grosir. Hanya jumlah dan tren yang ditampilkan, tanpa identitas pengirim, dan bahan dengan kurang dari 2 pengirim disembunyikan." },
  { title: "Asisten buka batch", body: "Saran tier 95% dan 90% dari harga pasar serta kuota dari permintaan mingguan dihitung dengan rumus, bukan dikarang model. Grosir tetap menentukan harganya sendiri." },
];

export default function AiTransparencyPage() {
  const selected = selectStage2Model(process.env);
  const provider = selected ? PROVIDER_INFO[selected.provider] : null;

  return <main>
    <PageHero crumbs={[{ label: "Transparansi AI" }]} title={<>Cara kerja <em>AI</em> di GroUp</>} description="Balasan bertanda 🤖 dibantu AI. Halaman ini menjelaskan kapan AI dipakai, data apa yang dikirim, dan batasannya." />

    <section className="section">
      <div className="section-head"><div><span className="eyebrow">Alur</span><h2>Kapan AI dipakai</h2></div></div>
      <ol className="timeline">
        {stages.map((stage, index) => <li key={stage.title}>
          <span className="timeline-icon"><Icon name={stage.icon} size={22} /></span>
          <div><small>Langkah {index + 1}</small><h3>{stage.title}</h3><p>{stage.body}</p></div>
        </li>)}
      </ol>
    </section>

    <section className="section info-grid">
      <article className="info-card">
        <span className="info-icon"><Icon name="chat" /></span>
        <h3>Data yang dikirim ke penyedia model</h3>
        <ul className="check-list">
          <li>Teks pesanmu dan sampai 6 pesan terakhir, setelah nomor telepon, alamat email, dan deret angka panjang disamarkan</li>
          <li>Ringkasan batch terbuka: nama bahan, satuan, kategori</li>
          <li>Pesananmu sendiri: kode, bahan, jumlah</li>
          <li>Hasil pencarian data yang diminta model: detail batch, pesananmu, harga pasar PIHPS</li>
          <li>Nomor WhatsApp dan nama di data pesanan tidak pernah dikirim. Nama atau alamat yang kamu ketik sendiri di pesan tidak disamarkan otomatis, jadi jangan tulis data pribadi</li>
        </ul>
      </article>
      <article className="info-card">
        <span className="info-icon"><Icon name="store" /></span>
        <h3>Penyedia model</h3>
        {provider && selected
          ? <><p><b>{provider.name}</b>, model <code>{selected.label}</code>.</p><p>{provider.retention}</p></>
          : <p>AI tahap 2 sedang tidak aktif. Teks bebas dibalas dengan menu.</p>}
      </article>
      <article className="info-card">
        <span className="info-icon"><Icon name="clock" /></span>
        <h3>Yang disimpan GroUp</h3>
        <ul className="check-list">
          <li>Riwayat percakapan dihapus otomatis setelah 30 hari</li>
          <li>Catatan teknis (tahap, intent, model, token, waktu proses) disimpan 90 hari tanpa isi pesan, dengan pengirim disamarkan sebagai hash</li>
          <li>Sesi percakapan dihapus setelah kedaluwarsa</li>
        </ul>
      </article>
      <article className="info-card">
        <span className="info-icon"><Icon name="shield" /></span>
        <h3>Batasan</h3>
        <ul className="check-list">
          <li>AI bisa keliru. Periksa jumlah dan batch sebelum menekan konfirmasi</li>
          <li>Angka dalam jawaban AI harus berasal dari data sistem; jawaban dengan angka yang tidak ditemukan di data diganti menu</li>
          <li>AI tidak menjanjikan refund, diskon, atau jadwal</li>
          <li>Paling banyak 20 balasan AI per jam per pengirim; setelah itu dibalas menu</li>
          <li>Harga pasar adalah data bulanan PIHPS Kota Bandung; prediksi bulan depan bukan jaminan</li>
        </ul>
      </article>
    </section>

    <section className="section">
      <div className="section-head"><div><span className="eyebrow">Label “Dibantu AI”</span><h2>AI untuk kepercayaan</h2></div></div>
      <div className="info-grid">
        {trustFeatures.map((feature) => <article key={feature.title} className="info-card"><h3>{feature.title}</h3><p>{feature.body}</p></article>)}
      </div>
    </section>

    <section className="section">
      <div className="section-head"><div><span className="eyebrow">Evaluasi</span><h2>Bagaimana kami mengujinya</h2></div></div>
      <p>Agen diuji dengan pesan tulisan tim yang tidak pernah dipakai untuk melatih model. Apa pun jawaban AI, pesanan baru tersimpan setelah kamu menekan tombol konfirmasi.</p>
    </section>

    <section className="section">
      <div className="cta-banner"><div><h2>Mau mencoba?</h2><p>Simulator memakai agen yang sama dengan nomor WhatsApp GroUp.</p></div><Link href="/simulator" className="button button-light">Buka simulator <Icon name="arrow" size={16} /></Link></div>
    </section>
  </main>;
}
