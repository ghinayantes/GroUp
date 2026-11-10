"use client";

import { useState } from "react";
import { send, useAction } from "@/components/dashboard/client";
import type { DashboardBatch, DashboardOrder } from "@/lib/dashboard-data";
import { formatDeadline, formatQuantity, resolveTiers, rupiah, statusLabel, type BatchStatus } from "@/lib/batch";

type Mode = "admin" | "grosir";

const paymentLabels: Record<DashboardOrder["paymentStatus"], string> = { not_due: "Belum ditagih", due: "Menunggu bayar", paid: "Lunas", refunded: "Dikembalikan" };
const channelLabels: Record<DashboardOrder["channel"], string> = { website: "Website", whatsapp: "WhatsApp", simulator: "Simulator" };
const fulfillmentLabels: Record<DashboardOrder["fulfillmentStatus"], string> = { pending: "Disiapkan", ready: "Siap diambil", collected: "Sudah diambil", delivered: "Sudah dikirim" };

const FILTERS: { value: BatchStatus | "all" | "expired"; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "open", label: "Terbuka" },
  { value: "expired", label: "Perlu ditutup" },
  { value: "successful", label: "Berhasil" },
  { value: "failed", label: "Tidak tercapai" },
];

function OrderRow({ order, batch, mode }: { order: DashboardOrder; batch: DashboardBatch; mode: Mode }) {
  const { busy, message, run } = useAction();
  const editable = mode === "admin" && batch.status === "successful" && order.status === "confirmed";
  const update = (patch: Partial<Pick<DashboardOrder, "paymentStatus" | "fulfillmentStatus">>) =>
    run(() => send(`/api/admin/orders/${order.id}`, "PATCH", { paymentStatus: patch.paymentStatus ?? order.paymentStatus, fulfillmentStatus: patch.fulfillmentStatus ?? order.fulfillmentStatus }), "Tersimpan");
  const price = order.finalUnitPrice ?? null;
  return <tr className={order.status === "cancelled" ? "row-muted" : undefined}>
    <td><b>{order.customerName}</b>{mode === "admin" && <small>{order.phone}</small>}</td>
    <td>{formatQuantity(order.quantity)} {batch.unit}{price !== null && <small>{rupiah(price * order.quantity)}</small>}</td>
    <td><span className="pill">{channelLabels[order.channel]}</span></td>
    <td>{order.status === "cancelled" ? "Dibatalkan" : "Aktif"}</td>
    <td>{editable ? <select disabled={busy} value={order.paymentStatus} onChange={(e) => update({ paymentStatus: e.target.value as DashboardOrder["paymentStatus"] })}>{(["due", "paid", "refunded"] as const).map((s) => <option key={s} value={s}>{paymentLabels[s]}</option>)}</select> : paymentLabels[order.paymentStatus]}</td>
    <td>{editable ? <select disabled={busy} value={order.fulfillmentStatus} onChange={(e) => update({ fulfillmentStatus: e.target.value as DashboardOrder["fulfillmentStatus"] })}>{(["pending", "ready", "collected", "delivered"] as const).map((s) => <option key={s} value={s}>{fulfillmentLabels[s]}</option>)}</select> : batch.status === "successful" ? fulfillmentLabels[order.fulfillmentStatus] : "—"}{message && message !== "Tersimpan" && <small className="form-error">{message}</small>}</td>
  </tr>;
}

function BatchCard({ batch, mode }: { batch: DashboardBatch; mode: Mode }) {
  const { busy, message, run } = useAction();
  const { current, next } = resolveTiers({ tiers: batch.tiers, current: batch.committed });
  const percent = Math.min(100, Math.round((batch.committed / batch.minimum) * 100));
  const reached = batch.committed >= batch.minimum;
  const activeOrders = batch.orders.filter((order) => order.status === "confirmed");
  const paid = activeOrders.filter((order) => order.paymentStatus === "paid").length;

  function close() {
    const outcome = reached
      ? `Kuota tercapai. Harga final ${current ? rupiah(current.unitPrice) : "—"}/${batch.unit} akan dibekukan dan ${activeOrders.length} pesanan ditagih.`
      : `Kuota BELUM tercapai (${formatQuantity(batch.committed)}/${formatQuantity(batch.minimum)} ${batch.unit}). Batch akan ditutup sebagai tidak tercapai tanpa penagihan.`;
    if (window.confirm(`${outcome}\n\nTutup batch ${batch.name}? Pesanan tidak bisa diubah setelahnya.`)) {
      run(() => send(`/api/${mode}/patungans/${batch.id}/close`, "POST"), "Batch ditutup.");
    }
  }

  return <article className="admin-batch">
    <header>
      <div>
        <span className={`pill status-${batch.status}`}>{batch.expired ? "Deadline lewat, perlu ditutup" : statusLabel[batch.status]}</span>
        <h3>{batch.name}</h3>
        <small>{mode === "admin" && `${batch.supplierName}${batch.supplierVerified ? " · terverifikasi" : " · belum terverifikasi"} · `}{batch.category} · deadline {formatDeadline(batch.closesAt)}</small>
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
        {batch.orders.map((order) => <OrderRow key={order.id} order={order} batch={batch} mode={mode} />)}
      </tbody></table></div> : <p className="admin-message">Belum ada pesanan.</p>}
    </details>
    {message && <p className="admin-message" role="status">{message}</p>}
  </article>;
}

type Filter = (typeof FILTERS)[number]["value"];

const matches = (batch: DashboardBatch, filter: Filter) =>
  filter === "all" || (filter === "expired" ? batch.expired : batch.status === filter && !(filter === "open" && batch.expired));

export default function BatchList({ batches, mode }: { batches: DashboardBatch[]; mode: Mode }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = batches.filter((batch) => matches(batch, filter));
  return <div>
    <div className="filter-tabs" role="tablist" aria-label="Filter status batch">
      {FILTERS.map((item) => <button key={item.value} role="tab" aria-selected={filter === item.value} className={filter === item.value ? "active" : undefined} onClick={() => setFilter(item.value)}>{item.label} <small>{batches.filter((batch) => matches(batch, item.value)).length}</small></button>)}
    </div>
    {shown.length === 0 ? <p className="admin-message">Tidak ada batch dengan status ini.</p> : <div className="admin-batches">{shown.map((batch) => <BatchCard key={batch.id} batch={batch} mode={mode} />)}</div>}
  </div>;
}
