"use client";

import { useState } from "react";
import Link from "next/link";
import { MAX_ORDER_QUANTITY, resolveTiers, rupiah, sortTiers, type Batch } from "@/lib/batch";

/** Perkiraan harga bila pesanan ini ditambahkan ke total saat ini; harga final ditetapkan saat batch ditutup. */
function estimate(batch: Batch, quantity: number) {
  const projected = batch.current + quantity;
  const tiers = sortTiers(batch.tiers);
  const tier = tiers.filter((item) => item.minQuantity <= projected).at(-1) ?? tiers[0];
  return { projected, unitPrice: tier?.unitPrice ?? 0, reachesMinimum: projected >= batch.minimum };
}

export default function OrderForm({ batch, whatsappNumber, onDone }: { batch: Batch; whatsappNumber?: string; onDone?: () => void }) {
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [managementCode, setManagementCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const { current } = resolveTiers(batch);
  const projection = estimate(batch, quantity);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: batch.id, customerName: name, phone, quantity }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Pesanan belum dapat diproses.");
      setManagementCode(result.managementCode || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  if (managementCode !== null) {
    return <div className="success-state">
      <span className="success-mark">✓</span>
      <div className="modal-eyebrow">PESANAN TERCATAT</div>
      <h2 id="modal-title">Kita belanja<br /><em>bareng-bareng.</em></h2>
      <p>Simpan kode rahasia ini — kode hanya ditampilkan sekali dan diperlukan untuk mengubah atau membatalkan pesanan selama batch masih terbuka.</p>
      <div className="management-code">{managementCode || "Kode tidak tersedia"}</div>
      {managementCode && <button type="button" className="link-button" onClick={() => navigator.clipboard?.writeText(managementCode).then(() => setCopied(true))}>{copied ? "Kode disalin ✓" : "Salin kode"}</button>}
      <p>Pembayaran baru diminta setelah batch berhasil ditutup pada harga final.</p>
      <Link className="whatsapp-link" href="/pesanan">Kelola pesanan →</Link>
      {onDone && <button className="button button-dark submit-button" onClick={onDone}>Selesai</button>}
    </div>;
  }

  return <form onSubmit={submit} className="order-form">
    <label>Nama usaha<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Dapur Nusa" /></label>
    <label>Nomor WhatsApp<input required type="tel" pattern="\+?[\d\s()\-]{8,20}" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="08xx xxxx xxxx" /></label>
    <label>Jumlah pesanan <span className="field-hint">({batch.unit})</span>
      <div className="quantity-control">
        <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Kurangi jumlah"><span>−</span></button>
        <input aria-label="Jumlah pesanan" type="number" min="0.001" max={MAX_ORDER_QUANTITY} step="any" value={quantity} onChange={(event) => setQuantity(Math.min(MAX_ORDER_QUANTITY, Math.max(0, Number(event.target.value))))} />
        <button type="button" onClick={() => setQuantity((value) => Math.min(MAX_ORDER_QUANTITY, value + 1))} aria-label="Tambah jumlah"><span>+</span></button>
      </div>
    </label>
    <div className="order-summary">
      <span>Harga tier saat ini</span><b>{rupiah(current?.unitPrice ?? 0)} <small>/ {batch.unit}</small></b>
      <span>Perkiraan setelah pesananmu</span><b>{rupiah(projection.unitPrice)} <small>/ {batch.unit}</small></b>
      <span>Total perkiraan</span><b>{rupiah(projection.unitPrice * quantity)}</b>
    </div>
    <p className="form-footnote form-rules"><b>Pembayaran:</b> {batch.paymentInstructions || "Diinformasikan setelah batch berhasil ditutup."}<br /><b>Penyerahan:</b> {batch.fulfillmentPlan || "Diinformasikan pengelola."}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-dark submit-button" disabled={loading || !(quantity > 0)}>{loading ? "Mencatat pesanan…" : "Konfirmasi ikut batch →"}</button>
    {whatsappNumber && <a className="whatsapp-link" target="_blank" rel="noreferrer" href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`MULAI ${batch.id}`)}`}>Atau pesan melalui WhatsApp →</a>}
    <p className="form-footnote">Belum ada pembayaran sekarang. Harga final mengikuti tier tertinggi yang tercapai saat batch ditutup; jika kuota minimum tidak tercapai, batch tidak diproses dan tidak ditagih.</p>
  </form>;
}
