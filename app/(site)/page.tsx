import Link from "next/link";
import BatchGrid, { JoinButton } from "@/components/site/BatchGrid";
import Countdown from "@/components/site/Countdown";
import Icon from "@/components/site/Icon";
import { daysLeft, formatQuantity, percentOf, photo, summarizeCategories, type Batch } from "@/lib/batch";
import { listOpenBatches } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function Home() {
  let batches: Batch[] = [];
  let loadError = "";
  try {
    batches = await listOpenBatches();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Daftar batch tidak dapat dimuat.";
  }
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const categories = summarizeCategories(batches);
  const featured = batches[0];
  const closingSoon = [...batches].sort((a, b) => a.closesAt.localeCompare(b.closesAt))[0];

  return <main>
    <section className="hero">
      <div className="hero-copy">
        <h1>Belanja bahan baku <span className="highlight">bareng<svg viewBox="0 0 200 20" aria-hidden="true"><path d="M4 15C50 4 140 2 196 10" /></svg></span>, harga grosir</h1>
        <p>Gabungkan kebutuhan usaha kecilmu dengan usaha sekitar dalam satu batch. Kuota tercapai, harga per unit ikut turun — dan kamu baru bayar setelah batch berhasil.</p>
        <div className="hero-actions">
          <Link href="/patungan" className="button button-dark">Lihat patungan <Icon name="arrow" size={17} /></Link>
          <Link href="/cara-kerja" className="text-link">Pelajari cara kerja</Link>
        </div>
      </div>
      <div className="hero-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- foto dekoratif dari CDN */}
        <img src={photo("photo-1488459716781-31db52582fe9", 1400)} alt="Lapak sayur dan buah segar" />
        {featured && <Link className="floating-card" href={`/patungan/${featured.id}`}>
          <div className="float-top"><span className="live-dot" />BATCH BERJALAN</div>
          <div className="float-product">{featured.name} <span>{formatQuantity(featured.current)} {featured.unit}</span></div>
          <div className="progress-track"><span style={{ width: `${percentOf(featured)}%` }} /></div>
          <div className="float-bottom"><span>{percentOf(featured)}% dari minimum</span><b>{daysLeft(featured.closesAt)} hari lagi</b></div>
        </Link>}
      </div>
    </section>

    <section className="trust-strip section">
      <div><Icon name="shield" /><span><b>Supplier diverifikasi manual</b><small>Status dan riwayat batch ditampilkan</small></span></div>
      <div><Icon name="chart" /><span><b>Harga bertingkat terbuka</b><small>Makin banyak kuota, makin ringan harganya</small></span></div>
      <div><Icon name="check" /><span><b>Bayar setelah berhasil</b><small>Kuota tak tercapai = tanpa tagihan</small></span></div>
      <div><Icon name="chat" /><span><b>Pesan via web atau WhatsApp</b><small>Tercatat di batch yang sama</small></span></div>
    </section>

    {categories.length > 0 && <section className="section">
      <div className="section-head section-head-center"><h2>Kategori bahan</h2><Link className="text-link" href="/kategori">Lihat semua kategori</Link></div>
      <div className="category-grid">
        {categories.map((item) => <Link key={item.slug} className="category-tile" href={`/kategori/${item.slug}`}>
          <span className="category-image">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL gambar dari admin */}
            {item.image && <img src={item.image} alt="" loading="lazy" />}
          </span>
          <span className="category-name">{item.name}</span>
          <small>{item.count} batch terbuka</small>
        </Link>)}
      </div>
    </section>}

    <section className="section promo-grid">
      <article className="promo promo-cream">
        <span className="promo-tag">Harga bertingkat</span>
        <h3>Kuota naik,<br />harga turun</h3>
        <p>Setiap batch punya ambang kuantitas. Harga final memakai tier tertinggi yang tercapai saat batch ditutup.</p>
        <Link href="/cara-kerja#simulasi" className="button button-dark">Coba simulasi <Icon name="arrow" size={16} /></Link>
        {/* eslint-disable-next-line @next/next/no-img-element -- foto dekoratif */}
        <img src={photo("photo-1542838132-92c53300491e", 700)} alt="" loading="lazy" />
      </article>
      <article className="promo promo-green">
        <span className="promo-tag">Tanpa bayar di muka</span>
        <h3>Bayar setelah<br />batch berhasil</h3>
        <p>Kuota minimum tidak tercapai? Batch tidak diproses dan kamu tidak ditagih.</p>
        <Link href="/patungan?sort=progres" className="button button-dark">Batch hampir penuh <Icon name="arrow" size={16} /></Link>
        {/* eslint-disable-next-line @next/next/no-img-element -- foto dekoratif */}
        <img src={photo("photo-1610832958506-aa56368176cf", 700)} alt="" loading="lazy" />
      </article>
    </section>

    <section className="band">
      <div className="section">
        <div className="section-head">
          <div><span className="eyebrow">Patungan</span><h2>Batch <em>minggu ini</em></h2></div>
          <Link className="text-link" href="/patungan">Lihat semua batch</Link>
        </div>
        {batches.length > 0
          ? <BatchGrid batches={batches.slice(0, 8)} whatsappNumber={whatsappNumber} />
          : <div className="empty-state"><span><Icon name="search" size={34} /></span><h3>{loadError ? "Batch belum dapat dimuat" : "Belum ada batch terbuka"}</h3><p>{loadError || "Batch baru dibuka setiap awal minggu. Coba lagi nanti."}</p></div>}
        {batches.length > 8 && <div className="see-more"><Link className="button button-outline" href="/patungan">Lihat {batches.length - 8} batch lainnya</Link></div>}
      </div>
    </section>

    {closingSoon && <section className="section deal-grid">
      <article className="deal-card">
        <span className="eyebrow">Segera ditutup</span>
        <h2>{closingSoon.name}</h2>
        <p>{formatQuantity(closingSoon.current)} dari {formatQuantity(closingSoon.minimum)} {closingSoon.unit} terkumpul · {closingSoon.supplier}</p>
        <Countdown closesAt={closingSoon.closesAt} />
        <JoinButton batch={closingSoon} whatsappNumber={whatsappNumber} label="Gabung sebelum tutup" />
      </article>
      <div className="deal-photo">
        {/* eslint-disable-next-line @next/next/no-img-element -- foto dekoratif */}
        <img src={photo("photo-1543168256-418811576931", 900)} alt="Tas belanja berisi bahan pangan" loading="lazy" />
      </div>
    </section>}

    <section className="section">
      <div className="section-head"><h2>Cara kerja patungan</h2><Link className="text-link" href="/cara-kerja">Selengkapnya</Link></div>
      <ol className="step-list">
        <li><b>Pilih batch</b><span>Lihat supplier, kuota minimum, tier harga, dan deadline sebelum ikut.</span></li>
        <li><b>Pesan lewat web atau WhatsApp</b><span>Kedua jalur masuk ke daftar dan progres batch yang sama.</span></li>
        <li><b>Batch ditutup</b><span>Kuota tercapai: harga final ditetapkan. Tidak tercapai: tidak ada tagihan.</span></li>
        <li><b>Bayar & terima barang</b><span>Ikuti aturan pembayaran dan penyerahan yang ditetapkan per batch.</span></li>
      </ol>
    </section>

    <section className="section">
      <div className="supplier-banner">
        <div><span className="eyebrow">Punya usaha supplier?</span><h2>Jangkau permintaan gabungan dari usaha lokal</h2></div>
        <p>Jadi mitra pemasok. Kami memverifikasi supplier secara manual sebelum batch dibuka.</p>
        <Link href="/supplier" className="button button-light">Jadi mitra supplier <Icon name="arrow" size={16} /></Link>
      </div>
    </section>
  </main>;
}
