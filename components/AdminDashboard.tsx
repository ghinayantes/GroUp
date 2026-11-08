"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/site/Brand";
import { useRouter } from "next/navigation";
import type { AdminBatch, AdminOrder, AdminSupplier } from "@/lib/admin";
import { formatDeadline, formatQuantity, resolveTiers, rupiah, statusLabel } from "@/lib/batch";

const paymentLabels: Record<AdminOrder["paymentStatus"], string> = { not_due: "Belum ditagih", due: "Menunggu bayar", paid: "Lunas", refunded: "Dikembalikan" };
const channelLabels: Record<AdminOrder["channel"], string> = { website: "Website", whatsapp: "WhatsApp", simulator: "Simulator" };
const fulfillmentLabels: Record<AdminOrder["fulfillmentStatus"], string> = { pending: "Disiapkan", ready: "Siap diambil", collected: "Sudah diambil", delivered: "Sudah dikirim" };

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Permintaan gagal.");
  return result;
}

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run<T>(task: () => Promise<T>, success: string | ((result: T) => string)) {
    setBusy(true); setMessage("");
    try { const result = await task(); setMessage(typeof success === "string" ? success : success(result)); router.refresh(); return true; }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Permintaan gagal."); return false; }
    finally { setBusy(false); }
  }
  return { busy, message, run };
}

function SupplierPanel({ suppliers }: { suppliers: AdminSupplier[] }) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { busy, message, run } = useAction();
  return <section className="admin-panel admin-wide">
    <div className="eyebrow eyebrow-dark">SUPPLIER</div>
    <h2>Verifikasi supplier</h2>
    <p>Verifikasi dilakukan manual (cek legalitas, kunjungan, atau contoh barang). Pembeli melihat status verifikasi dan jumlah batch yang selesai — tanpa skor numerik.</p>
    <form className="admin-inline" onSubmit={async (event) => { event.preventDefault(); if (await run(() => send("/api/admin/suppliers", "POST", { name }), "Supplier ditambahkan (belum terverifikasi).")) setName(""); }}>
      <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama supplier baru" aria-label="Nama supplier baru" />
      <button className="button button-dark" disabled={busy}>Tambah supplier</button>
    </form>
    {suppliers.length > 0 && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Supplier</th><th>Batch selesai</th><th>Catatan verifikasi</th><th>Status</th></tr></thead><tbody>
      {suppliers.map((supplier) => <tr key={supplier.id}>
        <td><b>{supplier.name}</b></td>
        <td>{supplier.completedBatches}</td>
        <td><input value={notes[supplier.id] ?? supplier.verificationNote} onChange={(e) => setNotes({ ...notes, [supplier.id]: e.target.value })} placeholder="Contoh: NIB dicek, kunjungan gudang 2 Nov" aria-label={`Catatan verifikasi ${supplier.name}`} /></td>
        <td><button className={supplier.verified ? "pill pill-ok" : "pill"} disabled={busy} onClick={() => run(() => send(`/api/admin/suppliers/${supplier.id}`, "PATCH", { verified: !supplier.verified, note: notes[supplier.id] ?? supplier.verificationNote }), supplier.verified ? "Verifikasi dicabut." : "Supplier ditandai terverifikasi.")}>{supplier.verified ? "Terverifikasi ✓" : "Tandai terverifikasi"}</button></td>
      </tr>)}
    </tbody></table></div>}
    {message && <p className="admin-message" role="status">{message}</p>}
  </section>;
}

function CreateBatchForm({ suppliers }: { suppliers: AdminSupplier[] }) {
  const empty = { supplierId: "", name: "", category: "Protein", unit: "kg", minimum: 100, closesAt: "", imageUrl: "", paymentInstructions: "", fulfillmentPlan: "" };
  const [form, setForm] = useState(empty);
  const [tiers, setTiers] = useState([{ minQuantity: 100, unitPrice: 35000 }]);
  const { busy, message, run } = useAction();
  const set = (key: keyof typeof empty) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: key === "minimum" ? Number(event.target.value) : event.target.value });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await run(() => send("/api/admin/patungans", "POST", { ...form, closesAt: new Date(form.closesAt).toISOString(), tiers }), "Batch dibuat dan tampil di halaman utama.");
    if (ok) { setForm({ ...empty, supplierId: form.supplierId }); setTiers([{ minQuantity: 100, unitPrice: 35000 }]); }
  }

  return <section className="admin-panel admin-wide">
    <div className="eyebrow eyebrow-dark">BATCH BARU</div>
    <h2>Buka patungan</h2>
    <p>Satu bahan baku per batch. Jadwal batch mingguan dibuat manual. Harga final memakai tier tertinggi yang tercapai saat batch ditutup.</p>
    {suppliers.length === 0 ? <p className="admin-message">Tambahkan supplier terlebih dahulu.</p> :
    <form className="admin-form admin-grid" onSubmit={submit}>
      <label>Supplier<select required value={form.supplierId} onChange={set("supplierId")}><option value="">Pilih supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.verified ? " ✓" : " (belum terverifikasi)"}</option>)}</select></label>
      <label>Nama bahan baku<input required value={form.name} onChange={set("name")} placeholder="Ayam fillet segar" /></label>
      <label>Kategori<input required list="categories" value={form.category} onChange={set("category")} /><datalist id="categories"><option>Protein</option><option>Sayuran</option><option>Bahan kering</option><option>Kemasan</option></datalist></label>
      <label>Satuan<input required value={form.unit} onChange={set("unit")} /></label>
      <label>Kuota minimum<input required type="number" min="0.001" step="any" value={form.minimum} onChange={set("minimum")} /></label>
      <label>Deadline batch<input required type="datetime-local" value={form.closesAt} onChange={set("closesAt")} /></label>
      <fieldset className="admin-tiers">
        <legend>Harga bertingkat <span className="field-hint">(ambang naik, harga turun; tier pertama ≤ kuota minimum)</span></legend>
        {tiers.map((tier, index) => <div className="admin-tier" key={index}>
          <label>Mulai dari<input required type="number" min="0.001" step="any" value={tier.minQuantity} onChange={(e) => setTiers(tiers.map((t, i) => i === index ? { ...t, minQuantity: Number(e.target.value) } : t))} /></label>
          <label>Harga / {form.unit || "unit"}<input required type="number" min="1" step="any" value={tier.unitPrice} onChange={(e) => setTiers(tiers.map((t, i) => i === index ? { ...t, unitPrice: Number(e.target.value) } : t))} /></label>
          {tiers.length > 1 && <button type="button" className="link-button" onClick={() => setTiers(tiers.filter((_, i) => i !== index))}>Hapus</button>}
        </div>)}
        {tiers.length < 6 && <button type="button" className="link-button" onClick={() => { const last = tiers.at(-1)!; setTiers([...tiers, { minQuantity: last.minQuantity * 1.5, unitPrice: Math.round(last.unitPrice * 0.95) }]); }}>+ Tambah tier</button>}
      </fieldset>
      <label className="admin-full">Aturan pembayaran<textarea required value={form.paymentInstructions} onChange={set("paymentInstructions")} placeholder="Contoh: tagihan dikirim via WhatsApp setelah batch berhasil; transfer ke rekening … paling lambat 2 hari." /></label>
      <label className="admin-full">Rencana penyerahan<textarea required value={form.fulfillmentPlan} onChange={set("fulfillmentPlan")} placeholder="Contoh: ambil di titik kumpul Pasar X, Sabtu 08.00–11.00." /></label>
      <label className="admin-full">URL gambar (opsional)<input type="url" value={form.imageUrl} onChange={set("imageUrl")} placeholder="https://…" /></label>
      <div className="admin-submit"><button className="button button-dark" disabled={busy}>{busy ? "Membuat…" : "Buka batch"}</button>{message && <p role="status">{message}</p>}</div>
    </form>}
  </section>;
}

function OrderRow({ order, batch }: { order: AdminOrder; batch: AdminBatch }) {
  const { busy, message, run } = useAction();
  const editable = batch.status === "successful" && order.status === "confirmed";
  const update = (patch: Partial<Pick<AdminOrder, "paymentStatus" | "fulfillmentStatus">>) =>
    run(() => send(`/api/admin/orders/${order.id}`, "PATCH", { paymentStatus: patch.paymentStatus ?? order.paymentStatus, fulfillmentStatus: patch.fulfillmentStatus ?? order.fulfillmentStatus }), "Tersimpan");
  const price = order.finalUnitPrice ?? null;
  return <tr className={order.status === "cancelled" ? "row-muted" : undefined}>
    <td><b>{order.customerName}</b><small>{order.phone}</small></td>
    <td>{formatQuantity(order.quantity)} {batch.unit}{price !== null && <small>{rupiah(price * order.quantity)}</small>}</td>
    <td><span className="pill">{channelLabels[order.channel]}</span></td>
    <td>{order.status === "cancelled" ? "Dibatalkan" : "Aktif"}</td>
    <td>{editable ? <select disabled={busy} value={order.paymentStatus} onChange={(e) => update({ paymentStatus: e.target.value as AdminOrder["paymentStatus"] })}>{(["due", "paid", "refunded"] as const).map((s) => <option key={s} value={s}>{paymentLabels[s]}</option>)}</select> : paymentLabels[order.paymentStatus]}</td>
    <td>{editable ? <select disabled={busy} value={order.fulfillmentStatus} onChange={(e) => update({ fulfillmentStatus: e.target.value as AdminOrder["fulfillmentStatus"] })}>{(["pending", "ready", "collected", "delivered"] as const).map((s) => <option key={s} value={s}>{fulfillmentLabels[s]}</option>)}</select> : batch.status === "successful" ? fulfillmentLabels[order.fulfillmentStatus] : "—"}{message && message !== "Tersimpan" && <small className="form-error">{message}</small>}</td>
  </tr>;
}

function BatchCard({ batch }: { batch: AdminBatch }) {
  const { busy, message, run } = useAction();
  const { current, next } = resolveTiers({ tiers: batch.tiers, current: batch.committed });
  const percent = Math.min(100, Math.round((batch.committed / batch.minimum) * 100));
  const { expired } = batch;
  const reached = batch.committed >= batch.minimum;
  const activeOrders = batch.orders.filter((order) => order.status === "confirmed");
  const paid = activeOrders.filter((order) => order.paymentStatus === "paid").length;

  function close() {
    const outcome = reached
      ? `Kuota tercapai. Harga final ${current ? rupiah(current.unitPrice) : "—"}/${batch.unit} akan dibekukan dan ${activeOrders.length} pesanan ditagih.`
      : `Kuota BELUM tercapai (${formatQuantity(batch.committed)}/${formatQuantity(batch.minimum)} ${batch.unit}). Batch akan ditutup sebagai tidak tercapai tanpa penagihan.`;
    if (window.confirm(`${outcome}\n\nTutup batch ${batch.name}? Pesanan tidak bisa diubah setelahnya.`)) {
      run(() => send(`/api/admin/patungans/${batch.id}/close`, "POST"), "Batch ditutup.");
    }
  }

  return <article className="admin-batch">
    <header>
      <div>
        <span className={`pill status-${batch.status}`}>{expired ? "Deadline lewat — perlu ditutup" : statusLabel[batch.status]}</span>
        <h3>{batch.name}</h3>
        <small>{batch.supplierName}{batch.supplierVerified ? " · terverifikasi" : " · belum terverifikasi"} · {batch.category} · deadline {formatDeadline(batch.closesAt)}</small>
      </div>
      {batch.status === "open" && <button className="button button-dark" disabled={busy} onClick={close}>{busy ? "Menutup…" : "Tutup batch"}</button>}
    </header>
    <div className="admin-stats">
      <span><small>Terkumpul</small><b>{formatQuantity(batch.committed)} / {formatQuantity(batch.minimum)} {batch.unit}</b></span>
      <span><small>{batch.status === "successful" ? "Harga final" : "Harga saat ini"}</small><b>{rupiah(batch.finalUnitPrice ?? current?.unitPrice ?? 0)}</b></span>
      <span><small>Tier berikutnya</small><b>{batch.status === "open" && next ? `${rupiah(next.unitPrice)} di ${formatQuantity(next.minQuantity)}` : "—"}</b></span>
      <span><small>Pesanan aktif</small><b>{activeOrders.length}{batch.status === "successful" && ` · ${paid} lunas`}</b></span>
    </div>
    <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
    <details>
      <summary>Aturan batch & {batch.orders.length} pesanan</summary>
      <dl className="admin-rules"><dt>Tier</dt><dd>{batch.tiers.map((tier) => `${formatQuantity(tier.minQuantity)}+ ${batch.unit}: ${rupiah(tier.unitPrice)}`).join(" · ")}</dd><dt>Pembayaran</dt><dd>{batch.paymentInstructions || "—"}</dd><dt>Penyerahan</dt><dd>{batch.fulfillmentPlan || "—"}</dd></dl>
      {batch.status === "failed" && <p className="admin-message">Batch tidak tercapai: pesanan disimpan sebagai riwayat, tidak ada pembayaran atau pemenuhan.</p>}
      {batch.orders.length > 0 ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pembeli</th><th>Jumlah</th><th>Kanal</th><th>Status</th><th>Pembayaran</th><th>Penyerahan</th></tr></thead><tbody>
        {batch.orders.map((order) => <OrderRow key={order.id} order={order} batch={batch} />)}
      </tbody></table></div> : <p className="admin-message">Belum ada pesanan.</p>}
    </details>
    {message && <p className="admin-message" role="status">{message}</p>}
  </article>;
}

export default function AdminDashboard({ batches, suppliers, loadError }: { batches: AdminBatch[]; suppliers: AdminSupplier[]; loadError?: string }) {
  return <main className="admin-shell">
    <header className="admin-header"><Brand /><Link href="/">Lihat website →</Link></header>
    {loadError && <p className="form-error admin-wide">{loadError}</p>}
    <section className="admin-panel admin-wide">
      <div className="eyebrow eyebrow-dark">PENGELOLAAN BATCH</div>
      <h1>Batch & pesanan</h1>
      <p>Pesanan dari website dan WhatsApp masuk ke daftar yang sama. Setelah deadline, tutup batch: di bawah minimum batch tidak diproses; jika tercapai, harga final dibekukan lalu pembayaran dan penyerahan dicatat manual.</p>
      {batches.length === 0 ? <p className="admin-message">Belum ada batch.</p> : <div className="admin-batches">{batches.map((batch) => <BatchCard key={batch.id} batch={batch} />)}</div>}
    </section>
    <CreateBatchForm suppliers={suppliers} />
    <SupplierPanel suppliers={suppliers} />
  </main>;
}
