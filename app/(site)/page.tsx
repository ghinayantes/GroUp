import Link from "next/link";
import DemoSignIn from "@/components/auth/DemoSignIn";
import DemoPipeline from "@/components/showcase/DemoPipeline";
import HeroMedia from "@/components/showcase/HeroMedia";
import MetricsStrip from "@/components/showcase/MetricsStrip";
import BatchGrid, { JoinButton } from "@/components/site/BatchGrid";
import ChatSimulator from "@/components/site/ChatSimulator";
import Countdown from "@/components/site/Countdown";
import Icon from "@/components/site/Icon";
import AiLabel from "@/components/trust/AiLabel";
import { FairPriceBadge } from "@/components/trust/FairPrice";
import { daysLeft, formatQuantity, percentOf, photo, rupiah, summarizeCategories, type Batch } from "@/lib/batch";
import { listOpenBatches } from "@/lib/orders";
import { marketGap } from "@/lib/showcase";
import { loadEvalHighlights } from "@/lib/showcase-data";
import { hasSupabaseSecret } from "@/lib/supabase/server";
import type { RadarEntry } from "@/lib/trust/demand-radar";
import { loadDemandRadar } from "@/lib/trust/demand-radar-data";
import { fairPriceSource } from "@/lib/trust/fair-price";

const SIMULATOR_SUGGESTIONS = ["mau ikut cabe 5 kilo", "harga bawang merah di pasar berapa?", "PESANAN"];

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
  const gap = marketGap(batches);
  const topSignal: RadarEntry | undefined = hasSupabaseSecret() ? (await loadDemandRadar().catch(() => []))[0] : undefined;
  const highlights = loadEvalHighlights();

  return <main>
    <section className="hero">
      <div className="hero-copy">
        <h1>Belanja bahan baku <span className="highlight">bareng<svg viewBox="0 0 200 20" aria-hidden="true"><path d="M4 15C50 4 140 2 196 10" /></svg></span>, harga grosir</h1>
        <p>UMKM menggabungkan kebutuhan dalam satu batch supaya dapat harga grosir. AI GroUp membantu di WhatsApp, membandingkan harga dengan data pasar resmi, dan menunjukkan rekam jejak supplier. Bayar hanya bila batch berhasil.</p>
        <div className="hero-actions">
          <Link href="/masuk" className="button button-dark">Coba sebagai juri <Icon name="arrow" size={17} /></Link>
          <Link href="#ai-berpikir" className="text-link">Lihat AI bekerja</Link>
        </div>
      </div>
      <HeroMedia videoUrl={process.env.NEXT_PUBLIC_DEMO_VIDEO_URL || undefined} posterUrl={process.env.NEXT_PUBLIC_DEMO_POSTER_URL || undefined}><div className="hero-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- foto dekoratif dari CDN */}
        <img src={photo("photo-1488459716781-31db52582fe9", 1400)} alt="Lapak sayur dan buah segar" />
        {featured && <Link className="floating-card" href={`/patungan/${featured.id}`}>
          <div className="float-top"><span className="live-dot" />BATCH BERJALAN</div>
          <div className="float-product">{featured.name} <span>{formatQuantity(featured.current)} {featured.unit}</span></div>
          <div className="progress-track"><span style={{ width: `${percentOf(featured)}%` }} /></div>
          <div className="float-bottom"><span>{percentOf(featured)}% dari minimum</span><b>{daysLeft(featured.closesAt)} hari lagi</b></div>
        </Link>}
      </div></HeroMedia>
    </section>

    <section className="section" aria-labelledby="demo-agen">
      <div className="section-head"><div><span className="eyebrow">Demo agen</span><h2 id="demo-agen">Lihat satu chat jadi <em>keputusan</em></h2></div><Link className="text-link" href="/simulator">Coba sendiri</Link></div>
      <p className="section-note">Rekaman asli simulator di production. Setiap klip menunjukkan cara agen memahami pesan, mengecek data, lalu menunggu konfirmasi pembeli.</p>
      <DemoPipeline />
    </section>

    {gap.length > 0 && <section className="section">
      <div className="section-head"><div><span className="eyebrow">Masalah dalam angka</span><h2>Harga pasar vs harga <em>patungan</em></h2></div></div>
      <div className="gap-grid">
        {gap.map((batch) => <Link key={batch.id} href={`/patungan/${batch.id}`} className="gap-card">
          <b>{batch.name}</b>
          <span className="gap-prices"><span><small>Pasar</small>{rupiah(batch.fairPrice.marketPrice)}/{batch.fairPrice.unit}</span><span><small>Patungan</small>{rupiah(batch.fairPrice.batchPrice)}/{batch.fairPrice.unit}</span></span>
          <FairPriceBadge fair={batch.fairPrice} />
        </Link>)}
      </div>
      <p className="section-note">Harga pasar dari {fairPriceSource(gap[0].fairPrice)}. Harga patungan memakai tier yang berlaku untuk kuantitas yang sudah terkumpul.</p>
    </section>}

    <section className="section">
      <div className="section-head"><div><span className="eyebrow">AI bekerja untuk siapa</span><h2>Satu agen, tiga <em>manfaat</em></h2></div><AiLabel /></div>
      <div className="ai-for-grid">
        <article className="info-card">
          <span className="info-icon"><Icon name="bag" /></span>
          <h3>Pembeli</h3>
          <p>Cek harga wajar dibanding PIHPS dan baca rekam jejak supplier sebelum ikut batch.</p>
          {gap[0] && <Link href={`/patungan/${gap[0].id}`} className="ai-for-sample"><b>{gap[0].name}</b><FairPriceBadge fair={gap[0].fairPrice} /></Link>}
        </article>
        <article className="info-card">
          <span className="info-icon"><Icon name="chart" /></span>
          <h3>Grosir</h3>
          <p>Radar permintaan dari pesan UMKM dan saran harga tier saat membuka batch.</p>
          {topSignal && <div className="ai-for-sample"><b>{topSignal.name}</b><span>{topSignal.senders} UMKM mencari{topSignal.weekly[0] && `, ±${formatQuantity(topSignal.weekly[0].quantity)} ${topSignal.weekly[0].unit}/minggu`}</span></div>}
        </article>
        <article className="info-card">
          <span className="info-icon"><Icon name="chat" /></span>
          <h3>Semua lewat WhatsApp</h3>
          <p>Pesan bebas dipahami agen; setiap pesanan tetap butuh tombol konfirmasi.</p>
          <div className="ai-for-chat">
            <small>Contoh percakapan</small>
            <span className="chat-bubble chat-bubble-user">mau ikut cabe 5 kilo</span>
            <span className="chat-bubble chat-bubble-bot"><span className="chat-ai-badge">AI</span><p>Ikut batch Cabai Merah Keriting 5 kg? Tekan tombol untuk konfirmasi.</p></span>
          </div>
        </article>
      </div>
    </section>

    <section id="ai-berpikir" className="section">
      <div className="section-head"><div><span className="eyebrow">Lihat AI berpikir</span><h2>Coba agennya <em>di sini</em></h2></div><Link className="text-link" href="/transparansi-ai">Transparansi AI</Link></div>
      <p className="section-note">Simulator memakai agen yang sama dengan nomor WhatsApp GroUp. Panel &ldquo;Di balik layar&rdquo; menunjukkan jalur yang dipakai, alasannya, dan guard yang aktif.</p>
      <ChatSimulator suggestions={SIMULATOR_SUGGESTIONS} traceOpen />
    </section>

    <MetricsStrip highlights={highlights} />

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

    <section className="section">
      <div className="cta-banner cta-demo">
        <div><h2>Coba GroUp tanpa mendaftar</h2><p>Akun demo sudah berisi batch, pesanan, dan sinyal permintaan. Data direset tiap malam.</p></div>
        <DemoSignIn className="cta-demo-buttons" buttonClass="button button-light" />
      </div>
    </section>
  </main>;
}
