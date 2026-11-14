import type { Batch } from "@/lib/batch";

/** Batch terbuka yang punya pembanding harga pasar, selisih terbesar dulu. */
export function marketGap(batches: Batch[], limit = 3) {
  return batches
    .filter((batch): batch is Batch & { fairPrice: NonNullable<Batch["fairPrice"]> } => batch.acceptingOrders && batch.fairPrice !== null)
    .sort((a, b) => b.fairPrice.savingPct - a.fairPrice.savingPct)
    .slice(0, limit);
}
