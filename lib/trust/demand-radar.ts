import { normalizeMaterial } from "@/lib/agent/extract";
import type { MarketPrice } from "@/lib/agent/ports";

export type DemandInterest = {
  senderKey: string;
  material: string;
  quantity: number | null;
  unit: string | null;
  frequency: "sekali" | "mingguan" | "bulanan" | null;
  createdAt: string;
};

export type UnitQuantity = { unit: string; quantity: number };

export type RadarEntry = {
  name: string;
  senders: number;
  /** Perkiraan kuantitas per minggu dari permintaan rutin, per satuan (satuan berbeda tidak dijumlahkan). */
  weekly: UnitQuantity[];
  /** Permintaan sekali beli atau tanpa frekuensi, per satuan. */
  once: UnitQuantity[];
  trend: { recent: number; previous: number };
  market: MarketPrice | null;
};

export const MIN_SENDERS = 2;
const WEEKS_PER_MONTH = 4.3;
const DAY_MS = 86_400_000;
const NO_UNIT = "satuan tidak disebut";

const titleCase = (text: string) => text.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());

function addTo(list: UnitQuantity[], unit: string, quantity: number) {
  const entry = list.find((item) => item.unit === unit);
  if (entry) entry.quantity += quantity;
  else list.push({ unit, quantity });
}

const round = (list: UnitQuantity[]) => list.map((item) => ({ ...item, quantity: Math.round(item.quantity * 10) / 10 })).sort((a, b) => b.quantity - a.quantity);

/**
 * Mengelompokkan minat aktif per bahan. Bahan yang cocok dengan PIHPS memakai nama komoditasnya (lewat marketFor,
 * yang memakai nameMatchScore dan ALIASES); sisanya dinormalisasi dengan ALIASES.
 */
export function demandRadar(interests: DemandInterest[], now: Date, marketFor: (material: string) => MarketPrice | null): RadarEntry[] {
  const groups = new Map<string, { market: MarketPrice | null; rows: DemandInterest[] }>();
  for (const interest of interests) {
    const market = marketFor(interest.material);
    const name = market?.material ?? titleCase(normalizeMaterial(interest.material));
    if (!name) continue;
    const group = groups.get(name) ?? { market, rows: [] };
    group.rows.push(interest);
    groups.set(name, group);
  }

  const entries: RadarEntry[] = [];
  for (const [name, { market, rows }] of groups) {
    const senders = new Set(rows.map((row) => row.senderKey));
    if (senders.size < MIN_SENDERS) continue;
    const weekly: UnitQuantity[] = [];
    const once: UnitQuantity[] = [];
    const recent = new Set<string>();
    const previous = new Set<string>();
    for (const row of rows) {
      const age = now.getTime() - new Date(row.createdAt).getTime();
      if (age <= 14 * DAY_MS) recent.add(row.senderKey);
      else if (age <= 28 * DAY_MS) previous.add(row.senderKey);
      if (row.quantity === null) continue;
      const unit = row.unit?.trim().toLowerCase() || NO_UNIT;
      if (row.frequency === "mingguan") addTo(weekly, unit, row.quantity);
      else if (row.frequency === "bulanan") addTo(weekly, unit, row.quantity / WEEKS_PER_MONTH);
      else addTo(once, unit, row.quantity);
    }
    entries.push({ name, senders: senders.size, weekly: round(weekly), once: round(once), trend: { recent: recent.size, previous: previous.size }, market });
  }
  return entries.sort((a, b) => b.senders - a.senders || a.name.localeCompare(b.name));
}

export type TierSuggestion = { tiers: { pct: 95 | 90; unitPrice: number }[]; minimum: number | null };

const floor100 = (value: number) => Math.floor(value / 100) * 100;
export const ceil10 = (value: number) => Math.ceil(value / 10) * 10;

/** Tier 95% dan 90% dari harga pasar (dibulatkan ke bawah ke Rp100); kuota minimum dari permintaan mingguan satuan yang sama. */
export function suggestTiers(market: MarketPrice, demand: RadarEntry | null): TierSuggestion {
  const weekly = demand?.weekly.find((item) => item.unit === market.unit.toLowerCase())?.quantity ?? 0;
  return {
    tiers: [
      { pct: 95, unitPrice: floor100(market.pricePerUnit * 0.95) },
      { pct: 90, unitPrice: floor100(market.pricePerUnit * 0.9) },
    ],
    minimum: weekly > 0 ? ceil10(weekly) : null,
  };
}

/** Tier yang harganya sama atau di atas harga pasar; dipakai untuk peringatan yang tidak memblokir. */
export const tiersAtOrAboveMarket = (tiers: { unitPrice: number }[], market: MarketPrice) => tiers.filter((tier) => tier.unitPrice >= market.pricePerUnit);
