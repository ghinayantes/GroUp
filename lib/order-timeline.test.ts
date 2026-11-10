import { describe, expect, it } from "vitest";
import { orderTimeline } from "./order-timeline";

const batch = { status: "open" as const, current: 40, minimum: 100, unit: "kg", acceptingOrders: true };
const states = (steps: ReturnType<typeof orderTimeline>) => steps.map((step) => step.state);

describe("orderTimeline", () => {
  it("batch terbuka: kuota berjalan, sisanya menunggu", () => {
    const steps = orderTimeline({ status: "confirmed", paymentStatus: "not_due", fulfillmentStatus: "pending", batch });
    expect(states(steps)).toEqual(["current", "upcoming", "upcoming"]);
    expect(steps[0].detail).toBe("40 / 100 kg");
  });

  it("batch berhasil dan belum bayar: pembayaran berjalan", () => {
    expect(states(orderTimeline({ status: "confirmed", paymentStatus: "due", fulfillmentStatus: "pending", batch: { ...batch, status: "successful" } })))
      .toEqual(["done", "current", "upcoming"]);
  });

  it("lunas dan sudah diambil: semua selesai", () => {
    const steps = orderTimeline({ status: "confirmed", paymentStatus: "paid", fulfillmentStatus: "collected", batch: { ...batch, status: "successful" } });
    expect(states(steps)).toEqual(["done", "done", "done"]);
    expect(steps[2].label).toBe("Sudah diambil");
  });

  it("batch gagal atau pesanan dibatalkan: tanpa tagihan", () => {
    expect(states(orderTimeline({ status: "confirmed", paymentStatus: "not_due", fulfillmentStatus: "pending", batch: { ...batch, status: "failed" } })))
      .toEqual(["skipped", "skipped", "skipped"]);
    expect(orderTimeline({ status: "cancelled", paymentStatus: "not_due", fulfillmentStatus: "pending", batch })[0].label).toBe("Pesanan dibatalkan");
  });
});
