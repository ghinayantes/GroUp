import "server-only";
import { sortTiers, type BatchStatus, type PriceTier } from "@/lib/batch";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type AdminSupplier = {
  id: string;
  name: string;
  verified: boolean;
  verificationNote: string;
  completedBatches: number;
};

export type AdminOrder = {
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

export type AdminBatch = {
  id: string;
  name: string;
  category: string;
  unit: string;
  supplierName: string;
  supplierVerified: boolean;
  minimum: number;
  closesAt: string;
  status: BatchStatus;
  /** Masih berstatus terbuka tetapi deadline sudah lewat: perlu ditutup admin. */
  expired: boolean;
  tiers: PriceTier[];
  paymentInstructions: string;
  fulfillmentPlan: string;
  finalQuantity: number | null;
  finalUnitPrice: number | null;
  committed: number;
  orders: AdminOrder[];
};

export async function listSuppliers(): Promise<AdminSupplier[]> {
  const supabase = createSupabaseAdminClient();
  const [suppliers, history] = await Promise.all([
    supabase.from("suppliers").select("id, display_name, is_verified, verification_note").order("display_name"),
    supabase.from("patungans").select("supplier_id").eq("status", "successful"),
  ]);
  if (suppliers.error || history.error) throw new Error("Data supplier tidak dapat dimuat.");
  const completed = new Map<string, number>();
  history.data.forEach((row) => completed.set(row.supplier_id, (completed.get(row.supplier_id) ?? 0) + 1));
  return suppliers.data.map((row) => ({
    id: row.id,
    name: row.display_name,
    verified: row.is_verified,
    verificationNote: row.verification_note ?? "",
    completedBatches: completed.get(row.id) ?? 0,
  }));
}

export async function listAdminBatches(): Promise<AdminBatch[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("patungans")
    .select("id, material_name, category, unit, min_quantity, closes_at, status, payment_instructions, fulfillment_plan, final_quantity, final_unit_price, suppliers(display_name, is_verified), patungan_price_tiers(min_quantity, unit_price), orders(id, customer_name, phone, quantity, channel, status, payment_status, fulfillment_status, final_unit_price, created_at)")
    .order("closes_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Data batch tidak dapat dimuat.");
  return data.map((row) => {
    const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
    const orders: AdminOrder[] = (row.orders ?? []).map((order) => ({
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
