"use client";

import { useState } from "react";
import { send, useAction } from "@/components/dashboard/client";
import type { DashboardSupplier } from "@/lib/dashboard-data";

function OwnerCell({ supplier }: { supplier: DashboardSupplier }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, message, run } = useAction();
  if (supplier.ownerEmail) return <td>{supplier.ownerEmail}</td>;
  return <td>
    <form className="owner-form" onSubmit={async (event) => {
      event.preventDefault();
      if (await run(() => send(`/api/admin/suppliers/${supplier.id}/owner`, "POST", { email, ...(password ? { password } : {}) }), "Akun grosir terhubung.")) { setEmail(""); setPassword(""); }
    }}>
      <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email akun grosir" aria-label={`Email akun grosir ${supplier.name}`} />
      <input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kata sandi (akun baru)" aria-label={`Kata sandi akun baru ${supplier.name}`} />
      <button className="link-button" disabled={busy}>Hubungkan</button>
    </form>
    {message && <small className={message.startsWith("Akun grosir terhubung") ? undefined : "form-error"}>{message}</small>}
  </td>;
}

export default function SupplierPanel({ suppliers }: { suppliers: DashboardSupplier[] }) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { busy, message, run } = useAction();
  return <section className="admin-panel admin-wide dash-panel">
    <p>Verifikasi dilakukan manual (cek legalitas, kunjungan, atau contoh barang). Pembeli melihat status verifikasi dan jumlah batch yang selesai, tanpa skor numerik. Hubungkan akun grosir supaya supplier bisa membuka batch sendiri; isi kata sandi bila akunnya belum ada.</p>
    <form className="admin-inline" onSubmit={async (event) => { event.preventDefault(); if (await run(() => send("/api/admin/suppliers", "POST", { name }), "Supplier ditambahkan (belum terverifikasi).")) setName(""); }}>
      <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama supplier baru" aria-label="Nama supplier baru" />
      <button className="button button-dark" disabled={busy}>Tambah supplier</button>
    </form>
    {suppliers.length > 0 && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Supplier</th><th>Batch selesai</th><th>Akun grosir</th><th>Catatan verifikasi</th><th>Status</th></tr></thead><tbody>
      {suppliers.map((supplier) => <tr key={supplier.id}>
        <td><b>{supplier.name}</b></td>
        <td>{supplier.completedBatches}</td>
        <OwnerCell supplier={supplier} />
        <td><input value={notes[supplier.id] ?? supplier.verificationNote} onChange={(e) => setNotes({ ...notes, [supplier.id]: e.target.value })} placeholder="Contoh: NIB dicek, kunjungan gudang 2 Nov" aria-label={`Catatan verifikasi ${supplier.name}`} /></td>
        <td><button className={supplier.verified ? "pill pill-ok" : "pill"} disabled={busy} onClick={() => run(() => send(`/api/admin/suppliers/${supplier.id}`, "PATCH", { verified: !supplier.verified, note: notes[supplier.id] ?? supplier.verificationNote }), supplier.verified ? "Verifikasi dicabut." : "Supplier ditandai terverifikasi.")}>{supplier.verified ? "Terverifikasi ✓" : "Tandai terverifikasi"}</button></td>
      </tr>)}
    </tbody></table></div>}
    {message && <p className="admin-message" role="status">{message}</p>}
  </section>;
}
