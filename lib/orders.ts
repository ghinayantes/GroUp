import "server-only";
import { type Batch, type BatchStatus } from "@/lib/batch";
import { demoBatches } from "@/lib/demo-data";
import { createSupabaseAdminClient, hasSupabaseSecret } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => uuidPattern.test(value);

type BatchRow = {
  id: string;
  material_name: string;
  category: string;
  unit: string;
  image_url: string | null;
  min_quantity: number | string;
  closes_at: string;
  status: string;
  payment_instructions: string;
  fulfillment_plan: string;
  final_unit_price: number | string | null;
  final_quantity: number | string | null;
  supplier_id: string;
  suppliers: { display_name: string; is_verified: boolean } | { display_name: string; is_verified: boolean }[] | null;
  patungan_price_tiers: { min_quantity: number | string; unit_price: number | string }[] | null;
};

const batchColumns = "id, material_name, category, unit, image_url, min_quantity, closes_at, status, payment_instructions, fulfillment_plan, final_unit_price, final_quantity, supplier_id, suppliers(display_name, is_verified), patungan_price_tiers(min_quantity, unit_price)";

async function hydrateBatches(rows: BatchRow[]): Promise<Batch[]> {
  if (!rows.length) return [];
  const supabase = createSupabaseAdminClient();
  const ids = rows.map((row) => row.id);
  const supplierIds = [...new Set(rows.map((row) => row.supplier_id))];
  const [ordersResult, historyResult] = await Promise.all([
    supabase.from("orders").select("patungan_id, quantity").in("patungan_id", ids).eq("status", "confirmed"),
    supabase.from("patungans").select("supplier_id").in("supplier_id", supplierIds).eq("status", "successful"),
  ]);
  if (ordersResult.error || historyResult.error) throw new Error("Progres batch tidak dapat dimuat.");

  const totals = new Map<string, number>();
  ordersResult.data.forEach((order) => totals.set(order.patungan_id, (totals.get(order.patungan_id) ?? 0) + Number(order.quantity)));
  const completed = new Map<string, number>();
  historyResult.data.forEach((row) => completed.set(row.supplier_id, (completed.get(row.supplier_id) ?? 0) + 1));

  return rows.map((row) => {
    const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
    const status = row.status as BatchStatus;
    return {
      id: row.id,
      name: row.material_name,
      category: row.category,
      unit: row.unit,
      supplier: supplier?.display_name ?? "Supplier",
      verified: Boolean(supplier?.is_verified),
      supplierCompletedBatches: completed.get(row.supplier_id) ?? 0,
      image: row.image_url ?? "",
      color: "#ead7c4",
      current: status === "open" ? totals.get(row.id) ?? 0 : Number(row.final_quantity ?? totals.get(row.id) ?? 0),
      minimum: Number(row.min_quantity),
      closesAt: row.closes_at,
      status,
      acceptingOrders: status === "open" && new Date(row.closes_at).getTime() > Date.now(),
      tiers: (row.patungan_price_tiers ?? []).map((tier) => ({ minQuantity: Number(tier.min_quantity), unitPrice: Number(tier.unit_price) })),
      paymentInstructions: row.payment_instructions,
      fulfillmentPlan: row.fulfillment_plan,
      finalUnitPrice: row.final_unit_price === null ? null : Number(row.final_unit_price),
    };
  });
}

export async function listOpenBatches(): Promise<Batch[]> {
  if (!hasSupabaseSecret()) return demoBatches;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("patungans")
    .select(batchColumns)
    .eq("status", "open")
    .gt("closes_at", new Date().toISOString())
    .order("closes_at");
  if (error) throw new Error("Daftar batch tidak dapat dimuat.");
  return hydrateBatches((data ?? []) as unknown as BatchRow[]);
}

/** Batch terbuka maupun yang sudah ditutup (berhasil/tidak tercapai) untuk halaman detail. */
export async function getBatch(id: string): Promise<Batch | null> {
  if (!hasSupabaseSecret()) return demoBatches.find((batch) => batch.id === id) ?? null;
  if (!isUuid(id)) return null;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("patungans").select(batchColumns).eq("id", id).in("status", ["open", "successful", "failed"]).maybeSingle();
  if (error) throw new Error("Batch tidak dapat dimuat.");
  if (!data) return null;
  const [batch] = await hydrateBatches([data as unknown as BatchRow]);
  return batch;
}

export async function getOpenBatch(id: string) {
  const batch = await getBatch(id);
  return batch?.acceptingOrders ? batch : null;
}
