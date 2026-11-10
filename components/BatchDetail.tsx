import Link from "next/link";
import OrderForm from "@/components/OrderForm";
import { FairPricePanel } from "@/components/trust/FairPrice";
import SupplierTrustCard from "@/components/trust/SupplierTrustCard";
import type { SupplierTrust } from "@/lib/trust/supplier-trust";
import { categorySlug, daysLeft, formatDeadline, formatQuantity, resolveTiers, rupiah, statusLabel, type Batch } from "@/lib/batch";

export default function BatchDetail({ batch, trust, whatsappNumber }: { batch: Batch; trust: SupplierTrust | null; whatsappNumber?: string }) {
  const { tiers, current, next } = resolveTiers(batch);
  const open = batch.acceptingOrders;
  const percent = Math.min(100, Math.round((batch.current / batch.minimum) * 100));
  const closedLabel = batch.status === "open" ? "Deadline lewat — menunggu penutupan" : statusLabel[batch.status];

  return <main className="section detail-page">
    <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Beranda</Link><span><Link href="/patungan">Patungan</Link></span><span><Link href={`/kategori/${categorySlug(batch.category)}`}>{batch.category}</Link></span><span aria-current="page">{batch.name}</span></nav>
    <div className="detail-grid">
      <section className="detail-main">
        {batch.image && <div className="detail-image" style={{ backgroundColor: batch.color }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- URL gambar dari admin, domain tidak tetap */}
          <img src={batch.image} alt={batch.name} />
        </div>}
        <div className="eyebrow eyebrow-dark">{batch.category.toUpperCase()} · {open ? `${daysLeft(batch.closesAt)} hari lagi` : closedLabel}</div>
        <h1>{batch.name}</h1>

        <div className="detail-supplier">
          <b>{batch.supplier}</b>
          {batch.verified ? <span className="pill pill-ok">Diverifikasi manual oleh pengelola</span> : <span className="pill">Belum terverifikasi</span>}
          <span>{batch.supplierCompletedBatches > 0 ? `${batch.supplierCompletedBatches} batch selesai sebelumnya` : "Belum ada riwayat batch selesai"}</span>
        </div>

        <div className="detail-progress">
          <div className="progress-label"><span><b>{formatQuantity(batch.current)} {batch.unit}</b> terkumpul</span><span>Kuota minimum {formatQuantity(batch.minimum)} {batch.unit}</span></div>
          <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
          <div className="progress-caption"><span>{percent}% dari kuota minimum</span><span>Deadline {formatDeadline(batch.closesAt)}</span></div>
        </div>

        {batch.fairPrice && <FairPricePanel fair={batch.fairPrice} />}

        <h2>Harga bertingkat</h2>
        <table className="tier-table">
          <thead><tr><th>Total batch</th><th>Harga / {batch.unit}</th><th /></tr></thead>
          <tbody>{tiers.map((tier) => {
            const active = batch.status === "successful" ? tier.unitPrice === batch.finalUnitPrice : tier === current;
            return <tr key={tier.minQuantity} className={active ? "tier-active" : undefined}>
              <td>≥ {formatQuantity(tier.minQuantity)} {batch.unit}</td>
              <td><b>{rupiah(tier.unitPrice)}</b></td>
              <td>{active ? (batch.status === "successful" ? "Harga final" : batch.current >= batch.minimum ? "Berlaku saat ini" : "Perkiraan (minimum belum tercapai)") : tier === next ? `Kurang ${formatQuantity(tier.minQuantity - batch.current)} ${batch.unit}` : ""}</td>
            </tr>;
          })}</tbody>
        </table>

        {trust && <SupplierTrustCard trust={trust} />}

        <h2>Aturan batch</h2>
        <dl className="detail-rules">
          <dt>Pembayaran</dt><dd>{batch.paymentInstructions || "Diinformasikan setelah batch berhasil ditutup."}</dd>
          <dt>Penyerahan</dt><dd>{batch.fulfillmentPlan || "Diinformasikan pengelola."}</dd>
          <dt>Jika kuota tidak tercapai</dt><dd>Batch ditutup sebagai tidak tercapai. Pesanan disimpan sebagai riwayat, tanpa penagihan maupun pengiriman.</dd>
          <dt>Ubah / batal</dt><dd>Selama batch masih terbuka, lewat kode pengelolaan (website) atau dari nomor WhatsApp yang sama.</dd>
        </dl>
      </section>

      <aside className="detail-aside order-modal">
        {open ? <>
          <div className="modal-eyebrow">GABUNG BATCH INI</div>
          <h2 id="modal-title">Ikut <em>patungan</em></h2>
          <OrderForm batch={batch} whatsappNumber={whatsappNumber} />
        </> : <>
          <div className="modal-eyebrow">BATCH DITUTUP</div>
          <h2>{closedLabel}</h2>
          <p className="modal-copy">{batch.status === "successful" ? `Harga final ${rupiah(batch.finalUnitPrice ?? 0)}/${batch.unit} untuk ${formatQuantity(batch.current)} ${batch.unit}. Peserta akan dihubungi untuk pembayaran dan penyerahan.` : "Pesanan baru tidak dapat dibuat untuk batch ini."}</p>
          <Link className="button button-dark submit-button" href="/patungan">Lihat batch lain</Link>
        </>}
      </aside>
    </div>
  </main>;
}
