import { describe, expect, it } from "vitest";
import { createMarketPricePort } from "@/lib/agent/adapters/market-price";
import type { MarketPrice } from "@/lib/agent/ports";
import { demandRadar, suggestTiers, tiersAtOrAboveMarket, type DemandInterest } from "./demand-radar";

const now = new Date("2026-11-10T00:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const interest = (senderKey: string, material: string, extra: Partial<DemandInterest> = {}): DemandInterest => ({
  senderKey, material, quantity: 10, unit: "kg", frequency: "mingguan", createdAt: daysAgo(1), ...extra,
});

const port = createMarketPricePort();
const prices = new Map<string, MarketPrice | null>();
for (const name of ["cabe merah keriting", "cabai keriting", "terigu", "tepung terigu", "telor ayam", "telur ayam ras", "bawang", "daging sapi"]) prices.set(name, await port.lookup(name, null));
const marketFor = (material: string) => prices.get(material) ?? null;

describe("demandRadar", () => {
  it("alias dan variasi nama digabung ke satu bahan", () => {
    const [cabai] = demandRadar([interest("a", "cabe merah keriting"), interest("b", "cabai keriting")], now, marketFor);
    expect(cabai).toMatchObject({ name: "Cabai Merah Keriting", senders: 2 });
    expect(cabai.market?.material).toBe("Cabai Merah Keriting");

    const [terigu] = demandRadar([interest("a", "terigu", { unit: "sak" }), interest("b", "tepung terigu", { unit: "sak" })], now, marketFor);
    expect(terigu).toMatchObject({ name: "Tepung Terigu", senders: 2, market: null });
  });

  it("bahan dengan kurang dari 2 pengirim unik tidak ditampilkan", () => {
    expect(demandRadar([interest("a", "daging sapi"), interest("a", "daging sapi")], now, marketFor)).toEqual([]);
  });

  it("satuan berbeda tidak dijumlahkan; bulanan dibagi 4,3; sekali beli terpisah", () => {
    const [telur] = demandRadar([
      interest("a", "telor ayam", { quantity: 10 }),
      interest("b", "telur ayam ras", { quantity: 43, frequency: "bulanan" }),
      interest("c", "telur ayam ras", { quantity: 4, unit: "tray" }),
      interest("d", "telur ayam ras", { quantity: 50, frequency: "sekali" }),
    ], now, marketFor);
    expect(telur.weekly).toEqual([{ unit: "kg", quantity: 20 }, { unit: "tray", quantity: 4 }]);
    expect(telur.once).toEqual([{ unit: "kg", quantity: 50 }]);
  });

  it("tren: pengirim 14 hari terakhir dibanding 14 hari sebelumnya", () => {
    const [entry] = demandRadar([
      interest("a", "tepung terigu", { createdAt: daysAgo(2) }),
      interest("b", "tepung terigu", { createdAt: daysAgo(5) }),
      interest("c", "tepung terigu", { createdAt: daysAgo(20) }),
      interest("d", "tepung terigu", { createdAt: daysAgo(40) }),
    ], now, marketFor);
    expect(entry.trend).toEqual({ recent: 2, previous: 1 });
  });
});

describe("suggestTiers", () => {
  const market: MarketPrice = { material: "Bawang Merah", region: "Kota Bandung", pricePerUnit: 35050, unit: "kg", source: "PIHPS", observedAt: "2026-11-02" };

  it("tier 95% dan 90% dibulatkan ke bawah ke Rp100, kuota dari permintaan mingguan dibulatkan ke atas ke 10", () => {
    const demand = { name: "Bawang Merah", senders: 3, weekly: [{ unit: "kg", quantity: 23.5 }], once: [], trend: { recent: 2, previous: 1 }, market };
    expect(suggestTiers(market, demand)).toEqual({ tiers: [{ pct: 95, unitPrice: 33200 }, { pct: 90, unitPrice: 31500 }], minimum: 30 });
  });

  it("tanpa data radar → kuota tidak disarankan", () => {
    expect(suggestTiers(market, null).minimum).toBeNull();
  });

  it("peringatan untuk tier yang menyamai atau melebihi harga pasar", () => {
    expect(tiersAtOrAboveMarket([{ unitPrice: 36000 }, { unitPrice: 35050 }, { unitPrice: 33000 }], market)).toHaveLength(2);
  });
});
