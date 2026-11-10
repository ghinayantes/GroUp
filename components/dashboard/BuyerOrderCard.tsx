"use client";

import Link from "next/link";
import { useState } from "react";
import { send, useAction } from "@/components/dashboard/client";
import { formatQuantity, resolveTiers, rupiah } from "@/lib/batch";
import type { ManagedOrder } from "@/lib/orders";
import { orderTimeline } from "@/lib/order-timeline";

export default function BuyerOrderCard({ order }: { order: ManagedOrder }) {
  const [quantity, setQuantity] = useState(order.quantity);
  const { busy, message, run } = useAction();
  const { current } = resolveTiers(order.batch);
  const unitPrice = order.finalUnitPrice ?? current?.unitPrice ?? null;

  return <article className="admin-batch buyer-order">
    <header>
      <div>
        <h3><Link href={`/patungan/${order.batch.id}`}>{order.batch.name}</Link></h3>
        <small>{order.batch.supplier} · {formatQuantity(order.quantity)} {order.batch.unit}{unitPrice !== null && ` · ${order.finalUnitPrice !== null ? "harga final" : "perkiraan"} ${rupiah(unitPrice * order.quantity)}`}</small>
      </div>
    </header>
    <ol className="order-timeline">
      {orderTimeline(order).map((step) => <li key={step.key} className={`step-${step.state}`}><b>{step.label}</b><small>{step.detail}</small></li>)}
    </ol>
    {order.editable && <form className="admin-inline" onSubmit={(event) => { event.preventDefault(); run(() => send(`/api/akun/orders/${order.id}`, "PATCH", { quantity }), "Jumlah pesanan diperbarui."); }}>
      <label className="sr-only" htmlFor={`qty-${order.id}`}>Jumlah</label>
      <input id={`qty-${order.id}`} type="number" min="0.001" step="any" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
      <button className="button button-dark" disabled={busy}>Ubah jumlah</button>
      <button type="button" className="link-button" disabled={busy} onClick={() => { if (window.confirm("Batalkan pesanan ini?")) run(() => send(`/api/akun/orders/${order.id}`, "DELETE"), "Pesanan dibatalkan."); }}>Batalkan</button>
    </form>}
    {message && <p className="admin-message" role="status">{message}</p>}
  </article>;
}
