import { resolveTiers, type Batch } from "@/lib/batch";
import type { MarketForecast, MarketPrice } from "@/lib/agent/ports";

export type FairPrice = {
  /** Harga tier saat ini (sesuai kuantitas terkumpul), atau harga final bila batch sudah berhasil. */
  batchPrice: number;
  /** Harga tier terbaik; null bila sama dengan batchPrice. */
  bestPrice: number | null;
  marketPrice: number;
  /** Positif = lebih murah dari pasar, negatif = lebih mahal. */
  savingPct: number;
  unit: string;
  source: string;
  region: string;
  observedAt: string;
  forecast: MarketForecast | null;
};

const normalizeUnit = (unit: string) => unit.trim().toLowerCase();

/** null bila nama bahan tidak cocok dengan yakin (market null) atau satuannya berbeda dari satuan PIHPS. */
export function fairPrice(batch: Pick<Batch, "tiers" | "current" | "unit" | "finalUnitPrice">, market: MarketPrice | null): FairPrice | null {
  if (!market || normalizeUnit(batch.unit) !== normalizeUnit(market.unit) || !(market.pricePerUnit > 0)) return null;
  const { tiers, current } = resolveTiers(batch);
  const batchPrice = batch.finalUnitPrice ?? current?.unitPrice;
  if (!batchPrice) return null;
  const lowest = Math.min(...tiers.map((tier) => tier.unitPrice));
  return {
    batchPrice,
    bestPrice: batch.finalUnitPrice === null && lowest < batchPrice ? lowest : null,
    marketPrice: market.pricePerUnit,
    savingPct: Math.round(((market.pricePerUnit - batchPrice) / market.pricePerUnit) * 100),
    unit: market.unit,
    source: market.source,
    region: market.region,
    observedAt: market.observedAt,
    forecast: market.forecast ?? null,
  };
}

const DATE = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

export const formatObservedAt = (iso: string) => DATE.format(new Date(`${iso}T00:00:00+07:00`));

export function fairPriceLabel(fair: FairPrice): string {
  if (fair.savingPct > 0) return `Hemat ${fair.savingPct}% vs pasar`;
  if (fair.savingPct < 0) return `Lebih mahal ${-fair.savingPct}% dari pasar`;
  return "Setara harga pasar";
}

export const fairPriceSource = (fair: FairPrice) => `${fair.source} ${fair.region}, ${formatObservedAt(fair.observedAt)}`;

/** Kalimat prediksi bulan depan; tidak mengklaim arah bila model menandai bergejolak atau tidak pasti. */
export function forecastLabel(forecast: MarketForecast): string {
  const range = `rentang Rp${forecast.low.toLocaleString("id-ID")}–Rp${forecast.high.toLocaleString("id-ID")}`;
  const change = Math.abs(Math.round(forecast.changePct));
  switch (forecast.status) {
    case "NAIK": return `Harga pasar diprediksi naik ±${change}% bulan depan (${range}).`;
    case "TURUN": return `Harga pasar diprediksi turun ±${change}% bulan depan (${range}).`;
    case "STABIL": return `Harga pasar diprediksi stabil bulan depan (${range}).`;
    case "BERGEJOLAK": return `Harga pasar bergejolak; prediksi bulan depan kurang andal (${range}).`;
    case "TIDAK PASTI": return `Arah harga pasar bulan depan belum pasti (${range}).`;
  }
}

type SavingOrder = { status: "confirmed" | "cancelled"; quantity: number; batch: { status: Batch["status"]; fairPrice: FairPrice | null } };

/** Selisih (harga pasar − harga patungan) × jumlah untuk pesanan aktif yang batch-nya tidak gagal dan punya data pasar. */
export function orderSavings(orders: SavingOrder[]): { total: number; counted: number; skipped: number } {
  const eligible = orders.filter((order) => order.status === "confirmed" && (order.batch.status === "open" || order.batch.status === "successful"));
  const counted = eligible.filter((order) => order.batch.fairPrice);
  return {
    total: Math.round(counted.reduce((sum, order) => sum + (order.batch.fairPrice!.marketPrice - order.batch.fairPrice!.batchPrice) * order.quantity, 0)),
    counted: counted.length,
    skipped: eligible.length - counted.length,
  };
}
