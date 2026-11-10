import { describe, expect, it } from "vitest";
import { createMarketPricePort } from "@/lib/agent/adapters/market-price";
import type { MarketPrice } from "@/lib/agent/ports";
import { fairPrice, fairPriceLabel, fairPriceSource, forecastLabel, orderSavings } from "./fair-price";

const market: MarketPrice = { material: "Bawang Merah", region: "Kota Bandung", pricePerUnit: 35000, unit: "kg", source: "PIHPS", observedAt: "2026-11-02", forecast: null };
const batch = { unit: "kg", current: 40, finalUnitPrice: null, tiers: [{ minQuantity: 50, unitPrice: 33000 }, { minQuantity: 100, unitPrice: 31500 }] };

describe("fairPrice", () => {
  it("hemat: tier saat ini dibanding pasar, tier terbaik sebagai bisa turun", () => {
    const fair = fairPrice(batch, market)!;
    expect(fair).toMatchObject({ batchPrice: 33000, bestPrice: 31500, marketPrice: 35000, savingPct: 6, unit: "kg" });
    expect(fairPriceLabel(fair)).toBe("Hemat 6% vs pasar");
    expect(fairPriceSource(fair)).toBe("PIHPS Kota Bandung, 2 Nov 2026");
  });

  it("lebih mahal ditampilkan apa adanya", () => {
    const fair = fairPrice({ ...batch, tiers: [{ minQuantity: 50, unitPrice: 36050 }] }, market)!;
    expect(fair.savingPct).toBe(-3);
    expect(fair.bestPrice).toBeNull();
    expect(fairPriceLabel(fair)).toBe("Lebih mahal 3% dari pasar");
  });

  it("batch berhasil memakai harga final", () => {
    expect(fairPrice({ ...batch, current: 120, finalUnitPrice: 31500 }, market)).toMatchObject({ batchPrice: 31500, bestPrice: null, savingPct: 10 });
  });

  it("satuan beda → null", () => {
    expect(fairPrice({ ...batch, unit: "sak" }, market)).toBeNull();
  });

  it("nama ambigu → null (port tidak mengembalikan harga)", async () => {
    const port = createMarketPricePort();
    expect(fairPrice(batch, await port.lookup("bawang", null))).toBeNull();
    expect(fairPrice(batch, await port.lookup("Bawang Merah", null))).not.toBeNull();
  });
});

describe("forecastLabel", () => {
  const forecast = { targetDate: "2026-12-01", price: 36400, low: 33000, high: 39800, changePct: 4.2, model: "naive", validationMape: 7 };
  it("naik dengan rentang", () => {
    expect(forecastLabel({ ...forecast, status: "NAIK" })).toBe("Harga pasar diprediksi naik ±4% bulan depan (rentang Rp33.000–Rp39.800).");
  });
  it("bergejolak tidak mengklaim arah", () => {
    expect(forecastLabel({ ...forecast, status: "BERGEJOLAK" })).not.toMatch(/naik|turun/);
  });
});

describe("orderSavings", () => {
  const fair = fairPrice(batch, market)!;
  it("menjumlah selisih pesanan aktif dengan data pasar, melewati batch gagal dan pesanan batal", () => {
    expect(orderSavings([
      { status: "confirmed", quantity: 10, batch: { status: "open", fairPrice: fair } },
      { status: "confirmed", quantity: 5, batch: { status: "successful", fairPrice: fair } },
      { status: "cancelled", quantity: 99, batch: { status: "open", fairPrice: fair } },
      { status: "confirmed", quantity: 99, batch: { status: "failed", fairPrice: fair } },
      { status: "confirmed", quantity: 3, batch: { status: "open", fairPrice: null } },
    ])).toEqual({ total: 30000, counted: 2, skipped: 1 });
  });
});
