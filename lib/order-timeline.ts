import { formatQuantity, type Batch } from "@/lib/batch";

export type StepState = "done" | "current" | "upcoming" | "skipped";

export type TimelineStep = { key: "quota" | "payment" | "fulfillment"; label: string; detail: string; state: StepState };

type OrderLike = {
  status: "confirmed" | "cancelled";
  paymentStatus: string;
  fulfillmentStatus: string;
  batch: Pick<Batch, "status" | "current" | "minimum" | "unit" | "acceptingOrders">;
};

const FULFILLED = new Set(["collected", "delivered"]);

/** Urutan kuota → pembayaran → penyerahan untuk satu pesanan. */
export function orderTimeline(order: OrderLike): TimelineStep[] {
  const { batch } = order;
  const quotaDetail = `${formatQuantity(batch.current)} / ${formatQuantity(batch.minimum)} ${batch.unit}`;
  if (order.status === "cancelled") {
    return [
      { key: "quota", label: "Pesanan dibatalkan", detail: "Tidak ikut dihitung di kuota.", state: "skipped" },
      { key: "payment", label: "Pembayaran", detail: "Tidak ada tagihan.", state: "skipped" },
      { key: "fulfillment", label: "Penyerahan", detail: "—", state: "skipped" },
    ];
  }
  if (batch.status === "failed" || batch.status === "cancelled") {
    return [
      { key: "quota", label: "Kuota tidak tercapai", detail: quotaDetail, state: "skipped" },
      { key: "payment", label: "Pembayaran", detail: "Tidak ada tagihan.", state: "skipped" },
      { key: "fulfillment", label: "Penyerahan", detail: "—", state: "skipped" },
    ];
  }
  if (batch.status === "open") {
    return [
      { key: "quota", label: batch.acceptingOrders ? "Mengumpulkan kuota" : "Menunggu batch ditutup", detail: quotaDetail, state: "current" },
      { key: "payment", label: "Pembayaran", detail: "Ditagih setelah batch berhasil.", state: "upcoming" },
      { key: "fulfillment", label: "Penyerahan", detail: "Sesuai rencana penyerahan batch.", state: "upcoming" },
    ];
  }
  const paid = order.paymentStatus === "paid";
  const refunded = order.paymentStatus === "refunded";
  const fulfilled = FULFILLED.has(order.fulfillmentStatus);
  return [
    { key: "quota", label: "Kuota tercapai", detail: quotaDetail, state: "done" },
    { key: "payment", label: refunded ? "Dana dikembalikan" : paid ? "Lunas" : "Menunggu pembayaran", detail: paid || refunded ? "Dicatat admin." : "Ikuti aturan pembayaran batch.", state: paid || refunded ? "done" : "current" },
    {
      key: "fulfillment",
      label: fulfilled ? (order.fulfillmentStatus === "delivered" ? "Sudah dikirim" : "Sudah diambil") : order.fulfillmentStatus === "ready" ? "Siap diambil" : "Disiapkan",
      detail: refunded ? "—" : "Sesuai rencana penyerahan batch.",
      state: refunded ? "skipped" : fulfilled ? "done" : paid ? "current" : "upcoming",
    },
  ];
}
