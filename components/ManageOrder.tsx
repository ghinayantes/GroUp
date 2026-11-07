"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDeadline, formatQuantity, MAX_ORDER_QUANTITY, rupiah, statusLabel } from "@/lib/batch";
import type { ManagedOrder } from "@/lib/orders";

const paymentLabels: Record<string, string> = { not_due: "Belum ditagih", due: "Menunggu pembayaran", paid: "Lunas", refunded: "Dikembalikan" };
const fulfillmentLabels: Record<string, string> = { pending: "Disiapkan", ready: "Siap diambil", collected: "Sudah diambil", delivered: "Sudah dikirim" };

export default function ManageOrder() {
  const [code, setCode] = useState("");
  const [order, setOrder] = useState<ManagedOrder | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function call(method: "POST" | "PATCH" | "DELETE", extra: Record<string, unknown> = {}, success = "") {
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/orders/manage", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ managementCode: code.trim(), ...extra }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Permintaan gagal.");
      setOrder(result.order);
      setQuantity(result.order?.quantity ?? 0);
      setMessage(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Permintaan gagal.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="manage-layout">
    <section className="admin-panel">
      <div className="eyebrow eyebrow-dark">PESANAN WEBSITE</div>
      <h2>Cari pesanan website</h2>
      <p>Masukkan kode pengelolaan yang ditampilkan saat pesanan dibuat. Pesanan dapat diubah atau dibatalkan selama batch masih terbuka. Pesanan WhatsApp dikelola dengan mengirim <b>PESANAN</b> dari nomor yang sama.</p>
      <form className="admin-form" onSubmit={(event) => { event.preventDefault(); call("POST"); }}>
        <label>Kode pengelolaan<input required autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Tempel kode di sini" /></label>
        <button className="button button-dark" disabled={loading}>{loading && !order ? "Mencari…" : "Cari pesanan"}</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}

      {order && <div className="managed-order">
        <h2>{order.batch.name}</h2>
        <dl className="detail-rules">
          <dt>Nama usaha</dt><dd>{order.customerName}</dd>
          <dt>Jumlah</dt><dd>{formatQuantity(order.quantity)} {order.batch.unit}</dd>
          <dt>Status pesanan</dt><dd>{order.status === "cancelled" ? "Dibatalkan" : "Aktif"}</dd>
          <dt>Status batch</dt><dd>{order.batch.status === "open" && !order.editable && order.status === "confirmed" ? "Deadline lewat — menunggu penutupan" : statusLabel[order.batch.status]} · deadline {formatDeadline(order.batch.closesAt)}</dd>
          {order.finalUnitPrice !== null && <><dt>Harga final</dt><dd>{rupiah(order.finalUnitPrice)}/{order.batch.unit} · total {rupiah(order.finalUnitPrice * order.quantity)}</dd></>}
          {order.batch.status === "successful" && order.status === "confirmed" && <><dt>Pembayaran</dt><dd>{paymentLabels[order.paymentStatus] ?? order.paymentStatus} — {order.batch.paymentInstructions}</dd><dt>Penyerahan</dt><dd>{fulfillmentLabels[order.fulfillmentStatus] ?? order.fulfillmentStatus} — {order.batch.fulfillmentPlan}</dd></>}
          {order.batch.status === "failed" && <><dt>Hasil</dt><dd>Kuota tidak tercapai. Tidak ada tagihan.</dd></>}
        </dl>
        {order.editable && <form className="admin-form" onSubmit={(event) => { event.preventDefault(); call("PATCH", { quantity }, "Jumlah pesanan diperbarui."); }}>
          <label>Ubah jumlah ({order.batch.unit})<input type="number" required min="0.001" max={MAX_ORDER_QUANTITY} step="any" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
          <div className="admin-inline">
            <button className="button button-dark" disabled={loading}>Simpan jumlah</button>
            <button type="button" className="link-button" disabled={loading} onClick={() => { if (window.confirm("Batalkan pesanan ini?")) call("DELETE", {}, "Pesanan dibatalkan."); }}>Batalkan pesanan</button>
          </div>
        </form>}
        {message && <p className="admin-message" role="status">{message}</p>}
      </div>}
    </section>
    <aside className="manage-aside">
      <article className="info-card"><h3>Pesan lewat WhatsApp?</h3><p>Kirim <b>PESANAN</b> dari nomor yang sama untuk melihat kode pesanan, lalu <b>UBAH &lt;kode&gt; &lt;jumlah&gt;</b> atau <b>BATAL &lt;kode&gt;</b>.</p></article>
      <article className="info-card"><h3>Kode hilang?</h3><p>Kode pengelolaan hanya ditampilkan sekali dan tidak dapat dipulihkan. Hubungi pengelola melalui WhatsApp dengan nama usaha dan batch yang kamu ikuti.</p></article>
      <article className="info-card"><h3>Kapan bayar?</h3><p>Hanya setelah batch berhasil ditutup. Status pembayaran dan penyerahan tampil di sini setelah dicatat pengelola.</p><Link className="text-link" href="/cara-kerja">Pelajari cara kerja</Link></article>
    </aside>
  </div>;
}
