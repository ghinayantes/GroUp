import { describe, expect, it } from "vitest";
import prediksi from "@/ai/harga/output/prediksi.json";
import { buildDemoPlan, DEMO_SENDER_PREFIX, priceAt } from "./plan";

let counter = 0;
const plan = buildDemoPlan({
  market: prediksi.prediksi,
  now: new Date("2026-11-10T00:00:00Z"),
  supplierId: "supplier",
  supplierName: "Grosir Demo",
  grosirId: "grosir",
  buyerId: "buyer",
  uuid: () => `id-${++counter}`,
  codeHash: () => "hash",
});

describe("buildDemoPlan", () => {
  it("6–8 batch dengan bahan PIHPS dan semua status", () => {
    expect(plan.batches.length).toBeGreaterThanOrEqual(6);
    expect(plan.batches.length).toBeLessThanOrEqual(8);
    expect(new Set(plan.batches.map((batch) => batch.status))).toEqual(new Set(["open", "successful", "failed"]));
  });

  it("tier di bawah harga pasar dan turun di tier kedua", () => {
    const cabai = plan.batches.find((batch) => batch.material_name === "Cabai Merah Keriting")!;
    const tiers = plan.tiers.filter((tier) => tier.patungan_id === cabai.id);
    expect(tiers.map((tier) => tier.unit_price)).toEqual([priceAt(94100, 97), priceAt(94100, 92)]);
    expect(tiers[1].unit_price).toBeLessThan(tiers[0].unit_price);
  });

  it("batch berhasil mencapai minimum, harga final dari tier yang tercapai, pesanan ditagih", () => {
    for (const batch of plan.batches.filter((row) => row.status === "successful")) {
      const orders = plan.orders.filter((order) => order.patungan_id === batch.id);
      const total = orders.reduce((sum, order) => sum + order.quantity, 0);
      expect(total).toBe(batch.final_quantity);
      expect(total).toBeGreaterThanOrEqual(batch.min_quantity as number);
      const reached = plan.tiers.filter((tier) => tier.patungan_id === batch.id && tier.min_quantity <= total).at(-1)!;
      expect(batch.final_unit_price).toBe(reached.unit_price);
      expect(orders.every((order) => order.final_unit_price === reached.unit_price && order.payment_status !== "not_due")).toBe(true);
    }
  });

  it("pesanan pembeli demo ada di berbagai status dan memakai kode pengelolaan", () => {
    const mine = plan.orders.filter((order) => order.buyer_user_id === "buyer");
    expect(mine.length).toBeGreaterThanOrEqual(4);
    expect(mine.every((order) => order.channel === "website" && order.management_code_hash)).toBe(true);
    expect(new Set(mine.map((order) => order.payment_status))).toEqual(new Set(["not_due", "due", "paid"]));
  });

  it("setiap baris seed menyimpan keadaan awal untuk reset harian", () => {
    expect(plan.batches.every((batch) => batch.demo_seed)).toBe(true);
    expect(plan.orders.every((order) => order.demo_seed.quantity === order.quantity)).toBe(true);
    expect(plan.interests.every((interest) => interest.demo_seed)).toBe(true);
  });

  it("±40 minat dari ±15 pengirim fiktif", () => {
    const senders = new Set(plan.interests.map((interest) => interest.sender_key));
    expect(plan.interests.length).toBeGreaterThanOrEqual(35);
    expect(plan.interests.length).toBeLessThanOrEqual(45);
    expect(senders.size).toBe(15);
    expect([...senders].every((sender) => String(sender).startsWith(DEMO_SENDER_PREFIX))).toBe(true);
  });

  it("batch terbuka disiapkan untuk simulasi agen", () => {
    expect(plan.openBatches.map((batch) => batch.name)).toEqual(["Cabai Merah Keriting", "Bawang Merah", "Telur Ayam Ras", "Daging Ayam Ras"]);
  });
});
