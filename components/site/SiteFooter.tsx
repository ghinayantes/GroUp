import Link from "next/link";
import { Brand } from "@/components/site/Brand";

export default function SiteFooter() {
  return <footer className="site-footer">
    <div className="footer-grid">
      <div className="footer-brand">
        <Brand className="brand brand-footer" />
        <p>Patungan bahan baku per batch untuk usaha mikro. Kuota, harga bertingkat, dan status pemenuhan terlihat terbuka.</p>
      </div>
      <div><h4>Belanja</h4><Link href="/patungan">Semua patungan</Link><Link href="/kategori">Kategori bahan</Link><Link href="/pesanan">Kelola pesanan</Link></div>
      <div><h4>Informasi</h4><Link href="/cara-kerja">Cara kerja</Link><Link href="/cara-kerja#faq">Pertanyaan umum</Link><Link href="/supplier">Untuk supplier</Link></div>
      <div><h4>Hubungi kami</h4><a href="mailto:mitra@group.id">mitra@group.id</a><span>Pesan via WhatsApp: kirim <b>MULAI</b></span><Link href="/simulator">Coba simulator</Link></div>
    </div>
    <div className="footer-bottom"><span>© 2026 GroUp</span><span>Belanja bersama, tumbuh bersama.</span></div>
  </footer>;
}
