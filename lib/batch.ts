export type PriceTier = { minQuantity: number; unitPrice: number };

export type BatchStatus = "open" | "successful" | "failed" | "cancelled";

export type Batch = {
  id: string;
  name: string;
  category: string;
  unit: string;
  supplier: string;
  verified: boolean;
  /** Jumlah batch supplier ini yang sudah selesai dengan sukses. */
  supplierCompletedBatches: number;
  image: string;
  color: string;
  current: number;
  minimum: number;
  closesAt: string;
  status: BatchStatus;
  /** Terbuka dan deadline belum lewat — pesanan baru/perubahan masih diterima. */
  acceptingOrders: boolean;
  tiers: PriceTier[];
  paymentInstructions: string;
  fulfillmentPlan: string;
  finalUnitPrice: number | null;
};

export const MAX_ORDER_QUANTITY = 100_000;

export const rupiah = (value: number) => `Rp${new Intl.NumberFormat("id-ID").format(value)}`;

export const formatQuantity = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(value);

export function sortTiers(tiers: PriceTier[]) {
  return [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);
}

/** Tier aktif = ambang tertinggi yang sudah dicapai; sebelum minimum tercapai, tampilkan tier pertama sebagai perkiraan. */
export function resolveTiers(batch: Pick<Batch, "tiers" | "current">) {
  const tiers = sortTiers(batch.tiers);
  const current = tiers.filter((tier) => tier.minQuantity <= batch.current).at(-1) ?? tiers[0] ?? null;
  const next = tiers.find((tier) => tier.minQuantity > batch.current && tier.minQuantity > (current?.minQuantity ?? 0)) ?? null;
  return { tiers, current, next };
}

export function daysLeft(closesAt: string, now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(closesAt).getTime() - now) / 86_400_000));
}

export function formatDeadline(closesAt: string) {
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(closesAt)) + " WIB";
}

export const statusLabel: Record<BatchStatus, string> = {
  open: "Terbuka",
  successful: "Berhasil — kuota tercapai",
  failed: "Tidak tercapai",
  cancelled: "Dibatalkan",
};

export function isValidQuantity(quantity: number) {
  return Number.isFinite(quantity) && quantity > 0 && quantity <= MAX_ORDER_QUANTITY && Math.round(quantity * 1000) === quantity * 1000;
}

export function categorySlug(name: string) {
  return name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export type CategorySummary = { name: string; slug: string; image: string; count: number };

export function summarizeCategories(batches: Batch[]): CategorySummary[] {
  const map = new Map<string, CategorySummary>();
  batches.forEach((batch) => {
    const entry = map.get(batch.category);
    if (entry) {
      entry.count += 1;
      entry.image ||= batch.image;
    } else {
      map.set(batch.category, { name: batch.category, slug: categorySlug(batch.category), image: batch.image, count: 1 });
    }
  });
  return [...map.values()];
}

export const percentOf = (batch: Pick<Batch, "current" | "minimum">) => Math.min(100, Math.round((batch.current / batch.minimum) * 100));

/** Foto dekoratif (Unsplash) untuk halaman publik. */
export const photo = (id: string, width = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;
