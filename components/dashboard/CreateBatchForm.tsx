"use client";

import { useState } from "react";
import ImageUpload from "@/components/admin/ImageUpload";
import { send, useAction } from "@/components/dashboard/client";
import type { DashboardSupplier } from "@/lib/dashboard-data";

export type BatchDraft = { name: string; category: string; unit: string; minimum: number };

const DEFAULT_TIERS = [{ minQuantity: 100, unitPrice: 35000 }];

/** Admin memilih supplier; grosir selalu membuka batch untuk supplier miliknya. */
export default function CreateBatchForm({ endpoint, suppliers, initial }: { endpoint: string; suppliers?: DashboardSupplier[]; initial?: Partial<BatchDraft> }) {
  const empty = { supplierId: "", name: "", category: "Protein", unit: "kg", minimum: 100, closesAt: "", paymentInstructions: "", fulfillmentPlan: "", ...initial };
  const [form, setForm] = useState(empty);
  const [tiers, setTiers] = useState(DEFAULT_TIERS);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { busy, message, run } = useAction();
  const set = (key: keyof typeof empty) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: key === "minimum" ? Number(event.target.value) : event.target.value });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { supplierId, ...batch } = form;
    const ok = await run(() => send(endpoint, "POST", { ...batch, ...(suppliers ? { supplierId } : {}), closesAt: new Date(form.closesAt).toISOString(), tiers, ...(imagePath ? { imagePath } : {}) }), "Batch dibuat dan tampil di halaman utama.");
    if (ok) { setForm({ ...empty, supplierId: form.supplierId }); setTiers(DEFAULT_TIERS); setImagePath(null); }
  }

  if (suppliers && suppliers.length === 0) return <p className="admin-message">Tambahkan supplier terlebih dahulu.</p>;

  return <form className="admin-form admin-grid" onSubmit={submit}>
    {suppliers && <label>Supplier<select required value={form.supplierId} onChange={set("supplierId")}><option value="">Pilih supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.verified ? " ✓" : " (belum terverifikasi)"}</option>)}</select></label>}
    <label>Nama bahan baku<input required value={form.name} onChange={set("name")} placeholder="Cabai merah keriting" /></label>
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
    <div className="admin-full admin-field">Foto bahan (opsional)<ImageUpload value={imagePath} onChange={setImagePath} onBusyChange={setUploading} /></div>
    <div className="admin-submit"><button className="button button-dark" disabled={busy || uploading}>{busy ? "Membuat…" : "Buka batch"}</button>{message && <p role="status">{message}</p>}</div>
  </form>;
}
