import "server-only";
import type { TraceRow } from "@/lib/ai-activity";
import { sortTiers, type BatchStatus, type PriceTier } from "@/lib/batch";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type DashboardSupplier = {
  id: string;
  name: string;
  verified: boolean;
  verificationNote: string;
  completedBatches: number;
  ownerEmail: string | null;
  createdAt: string;
};

export type DashboardOrder = {
  id: string;
  customerName: string;
  phone: string;
  quantity: number;
  channel: "website" | "whatsapp" | "simulator";
  status: "confirmed" | "cancelled";
  paymentStatus: "not_due" | "due" | "paid" | "refunded";
  fulfillmentStatus: "pending" | "ready" | "collected" | "delivered";
  finalUnitPrice: number | null;
  createdAt: string;
};

export type DashboardBatch = {
  id: string;
  name: string;
  category: string;
  unit: string;
  supplierName: string;
  supplierVerified: boolean;
  minimum: number;
  closesAt: string;
  status: BatchStatus;
  /** Masih berstatus terbuka tetapi deadline sudah lewat: perlu ditutup. */
  expired: boolean;
  tiers: PriceTier[];
  paymentInstructions: string;
  fulfillmentPlan: string;
  finalQuantity: number | null;
  finalUnitPrice: number | null;
  committed: number;
  orders: DashboardOrder[];
};

async function ownerEmails(ownerIds: string[]) {
  const supabase = createSupabaseAdminClient();
  const users = await Promise.all(ownerIds.map((id) => supabase.auth.admin.getUserById(id)));
  return new Map(users.flatMap(({ data }) => (data.user ? [[data.user.id, data.user.email ?? null] as const] : [])));
}

export async function listSuppliers(): Promise<DashboardSupplier[]> {
  const supabase = createSupabaseAdminClient();
  const [suppliers, history] = await Promise.all([
    supabase.from("suppliers").select("id, display_name, is_verified, verification_note, owner_user_id, created_at").order("display_name"),
    supabase.from("patungans").select("supplier_id").eq("status", "successful"),
  ]);
  if (suppliers.error || history.error) throw new Error("Data supplier tidak dapat dimuat.");
  const completed = new Map<string, number>();
  history.data.forEach((row) => completed.set(row.supplier_id, (completed.get(row.supplier_id) ?? 0) + 1));
  const emails = await ownerEmails(suppliers.data.flatMap((row) => (row.owner_user_id ? [row.owner_user_id] : [])));
  return suppliers.data.map((row) => ({
    id: row.id,
    name: row.display_name,
    verified: row.is_verified,
    verificationNote: row.verification_note ?? "",
    completedBatches: completed.get(row.id) ?? 0,
    ownerEmail: row.owner_user_id ? emails.get(row.owner_user_id) ?? null : null,
    createdAt: row.created_at,
  }));
}

/** Supplier milik akun grosir beserta riwayatnya; null bila belum dihubungkan. */
export async function supplierForOwner(userId: string): Promise<DashboardSupplier | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("suppliers").select("id, display_name, is_verified, verification_note, created_at").eq("owner_user_id", userId).maybeSingle();
  if (error) throw new Error("Data supplier tidak dapat dimuat.");
  if (!data) return null;
  const { count } = await supabase.from("patungans").select("id", { count: "exact", head: true }).eq("supplier_id", data.id).eq("status", "successful");
  return {
    id: data.id,
    name: data.display_name,
    verified: data.is_verified,
    verificationNote: data.verification_note ?? "",
    completedBatches: count ?? 0,
    ownerEmail: null,
    createdAt: data.created_at,
  };
}

/** Batch terbaru; dengan supplierId hanya batch supplier tersebut. */
export async function listBatches(supplierId?: string): Promise<DashboardBatch[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("patungans")
    .select("id, material_name, category, unit, min_quantity, closes_at, status, payment_instructions, fulfillment_plan, final_quantity, final_unit_price, suppliers(display_name, is_verified), patungan_price_tiers(min_quantity, unit_price), orders(id, customer_name, phone, quantity, channel, status, payment_status, fulfillment_status, final_unit_price, created_at)");
  if (supplierId) query = query.eq("supplier_id", supplierId);
  const { data, error } = await query.order("closes_at", { ascending: false }).limit(50);
  if (error) throw new Error("Data batch tidak dapat dimuat.");
  return data.map((row) => {
    const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
    const orders: DashboardOrder[] = (row.orders ?? []).map((order) => ({
      id: order.id,
      customerName: order.customer_name,
      phone: order.phone,
      quantity: Number(order.quantity),
      channel: order.channel,
      status: order.status,
      paymentStatus: order.payment_status,
      fulfillmentStatus: order.fulfillment_status,
      finalUnitPrice: order.final_unit_price === null ? null : Number(order.final_unit_price),
      createdAt: order.created_at,
    })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return {
      id: row.id,
      name: row.material_name,
      category: row.category,
      unit: row.unit,
      supplierName: supplier?.display_name ?? "—",
      supplierVerified: Boolean(supplier?.is_verified),
      minimum: Number(row.min_quantity),
      closesAt: row.closes_at,
      status: row.status as BatchStatus,
      expired: row.status === "open" && new Date(row.closes_at).getTime() <= Date.now(),
      tiers: sortTiers((row.patungan_price_tiers ?? []).map((tier) => ({ minQuantity: Number(tier.min_quantity), unitPrice: Number(tier.unit_price) }))),
      paymentInstructions: row.payment_instructions,
      fulfillmentPlan: row.fulfillment_plan,
      finalQuantity: row.final_quantity === null ? null : Number(row.final_quantity),
      finalUnitPrice: row.final_unit_price === null ? null : Number(row.final_unit_price),
      committed: orders.filter((order) => order.status === "confirmed").reduce((sum, order) => sum + order.quantity, 0),
      orders,
    };
  });
}

export type BatchKpis = { activeBatches: number; activeOrders: number; transactionValue: number };

/** Nilai transaksi = harga final × jumlah untuk pesanan aktif di batch yang berhasil. */
export function batchKpis(batches: DashboardBatch[]): BatchKpis {
  const confirmed = (batch: DashboardBatch) => batch.orders.filter((order) => order.status === "confirmed");
  return {
    activeBatches: batches.filter((batch) => batch.status === "open" && !batch.expired).length,
    activeOrders: batches.filter((batch) => batch.status === "open").reduce((sum, batch) => sum + confirmed(batch).length, 0),
    transactionValue: batches.filter((batch) => batch.status === "successful")
      .reduce((sum, batch) => sum + confirmed(batch).reduce((total, order) => total + (order.finalUnitPrice ?? batch.finalUnitPrice ?? 0) * order.quantity, 0), 0),
  };
}

/** Trace agen 30 hari terakhir, terbaru dulu. Isi pesan memang tidak disimpan di trace. */
export async function listRecentTraces(limit = 2000): Promise<TraceRow[]> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await createSupabaseAdminClient().from("agent_traces")
    .select("id, created_at, channel, stage, intent, confidence, action, model, input_tokens, output_tokens, latency_ms, tools")
    .gte("created_at", since).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error("Trace agen tidak dapat dimuat.");
  return data as TraceRow[];
}
