import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createMarketPricePort } from "@/lib/agent/adapters/market-price";
import { isValidQuantity, type Batch, type BatchStatus } from "@/lib/batch";
import { fairPrice } from "@/lib/trust/fair-price";
import { isUuid } from "@/lib/uuid";
import { demoBatches } from "@/lib/demo-data";
import { createSupabaseAdminClient, hasSupabaseSecret } from "@/lib/supabase/server";
import type { Channel, Frequency } from "@/lib/agent/types";

const hashCode = (value: string) => createHash("sha256").update(value.trim()).digest("hex");
export const normalizePhone = (phone: string) => phone.replace(/[\s()-]/g, "");
const senderPhone = (channel: "website" | Channel, value: string) => (channel === "simulator" ? value : normalizePhone(value));

export const BATCH_CLOSED_MESSAGE = "Batch ini sudah ditutup. Pesanan tidak dapat dibuat atau diubah.";
export const ORDER_NOT_FOUND_MESSAGE = "Pesanan tidak ditemukan. Periksa kode pengelolaan.";
export const INVALID_QUANTITY_MESSAGE = "Jumlah harus lebih dari nol dan maksimal 100.000.";
const SIMULATOR_LIMIT_MESSAGE = "Batas pesanan simulator untuk batch ini sudah penuh.";

export type CreateOrderInput = {
  groupId: string;
  customerName: string;
  phone: string;
  quantity: number;
  channel?: "website" | Channel;
  providerMessageId?: string;
  /** Pembeli yang sedang login; hanya untuk pesanan website. */
  buyerUserId?: string | null;
};

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

  const market = createMarketPricePort();
  return Promise.all(rows.map(async (row) => {
    const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
    const status = row.status as BatchStatus;
    const tiers = (row.patungan_price_tiers ?? []).map((tier) => ({ minQuantity: Number(tier.min_quantity), unitPrice: Number(tier.unit_price) }));
    const current = status === "open" ? totals.get(row.id) ?? 0 : Number(row.final_quantity ?? totals.get(row.id) ?? 0);
    const finalUnitPrice = row.final_unit_price === null ? null : Number(row.final_unit_price);
    return {
      id: row.id,
      name: row.material_name,
      category: row.category,
      unit: row.unit,
      supplierId: row.supplier_id,
      supplier: supplier?.display_name ?? "Supplier",
      verified: Boolean(supplier?.is_verified),
      supplierCompletedBatches: completed.get(row.supplier_id) ?? 0,
      image: row.image_url ?? "",
      color: "#ead7c4",
      current,
      minimum: Number(row.min_quantity),
      closesAt: row.closes_at,
      status,
      acceptingOrders: status === "open" && new Date(row.closes_at).getTime() > Date.now(),
      tiers,
      paymentInstructions: row.payment_instructions,
      fulfillmentPlan: row.fulfillment_plan,
      finalUnitPrice,
      fairPrice: fairPrice({ tiers, current, unit: row.unit, finalUnitPrice }, await market.lookup(row.material_name, null)),
    };
  }));
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

function rpcMessage(message: string, fallback: string) {
  if (message.includes("batch_closed")) return BATCH_CLOSED_MESSAGE;
  if (message.includes("order_not_found")) return ORDER_NOT_FOUND_MESSAGE;
  if (message.includes("simulator_limit")) return SIMULATOR_LIMIT_MESSAGE;
  if (message.includes("invalid_order") || message.includes("invalid_action")) return INVALID_QUANTITY_MESSAGE;
  return fallback;
}

function isValidSender(channel: CreateOrderInput["channel"], phone: string) {
  if (channel !== "simulator") return /^\+?[\d\s()-]{8,20}$/.test(phone);
  return phone.length >= 8 && phone.length <= 24;
}

export async function createOrder(input: CreateOrderInput) {
  const name = input.customerName.trim();
  if (name.length < 2 || name.length > 120 || !isValidSender(input.channel, input.phone) || !isValidQuantity(input.quantity)) {
    throw new Error("Periksa nama, nomor WhatsApp, dan jumlah pesanan (maksimal 100.000, hingga 3 desimal).");
  }
  if (!hasSupabaseSecret()) throw new Error("Pemesanan belum aktif. Lengkapi konfigurasi Supabase di .env.local.");
  if (!isUuid(input.groupId)) throw new Error("Batch tidak ditemukan.");

  const channel = input.channel ?? "website";
  const code = channel === "website" ? randomBytes(18).toString("base64url") : null;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("create_group_order", {
    p_patungan_id: input.groupId,
    p_customer_name: name,
    p_phone: senderPhone(channel, input.phone),
    p_quantity: input.quantity,
    p_channel: channel,
    p_management_code_hash: code ? hashCode(code) : null,
    p_provider_message_id: input.providerMessageId ?? null,
    p_buyer_user_id: channel === "website" ? input.buyerUserId ?? null : null,
  });
  if (error) throw new Error(rpcMessage(error.message, "Pesanan belum dapat dicatat. Coba lagi."));
  return { id: data as string, managementCode: code };
}

export type ManagedOrder = {
  id: string;
  customerName: string;
  quantity: number;
  status: "confirmed" | "cancelled";
  paymentStatus: string;
  fulfillmentStatus: string;
  finalUnitPrice: number | null;
  createdAt: string;
  batch: Batch;
  editable: boolean;
};

async function toManagedOrder(row: { id: string; patungan_id: string; customer_name: string; quantity: number | string; status: string; payment_status: string; fulfillment_status: string; final_unit_price: number | string | null; created_at: string }): Promise<ManagedOrder | null> {
  const batch = await getBatch(row.patungan_id);
  if (!batch) return null;
  const status = row.status as ManagedOrder["status"];
  return {
    id: row.id,
    customerName: row.customer_name,
    quantity: Number(row.quantity),
    status,
    paymentStatus: row.payment_status,
    fulfillmentStatus: row.fulfillment_status,
    finalUnitPrice: row.final_unit_price === null ? null : Number(row.final_unit_price),
    createdAt: row.created_at,
    batch,
    editable: status === "confirmed" && batch.acceptingOrders,
  };
}

const orderColumns = "id, patungan_id, customer_name, quantity, status, payment_status, fulfillment_status, final_unit_price, created_at";

/** Mencari pesanan website dari kode pengelolaan. Kode salah tidak mengungkap apa pun. */
export async function findOrderByCode(code: string): Promise<ManagedOrder | null> {
  if (!hasSupabaseSecret()) throw new Error("Pengelolaan pesanan belum aktif. Lengkapi konfigurasi Supabase.");
  if (code.trim().length < 16) return null;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("orders").select(orderColumns)
    .eq("channel", "website").eq("management_code_hash", hashCode(code)).maybeSingle();
  if (error) throw new Error("Pesanan tidak dapat dimuat.");
  return data ? toManagedOrder(data) : null;
}

export async function updateOrderByCode(code: string, quantity: number) {
  if (!isValidQuantity(quantity)) throw new Error(INVALID_QUANTITY_MESSAGE);
  const order = await findOrderByCode(code);
  if (!order) throw new Error(ORDER_NOT_FOUND_MESSAGE);
  await manageOrder(order.id, { code }, "update", quantity);
}

export async function cancelOrderByCode(code: string) {
  const order = await findOrderByCode(code);
  if (!order) throw new Error(ORDER_NOT_FOUND_MESSAGE);
  await manageOrder(order.id, { code }, "cancel", null);
}

/** Pesanan aktif dari pengirim yang sama di kanal agen (WhatsApp atau simulator). */
export async function listOrdersForSender(channel: Channel, senderKey: string): Promise<ManagedOrder[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("orders").select(orderColumns)
    .eq("channel", channel).eq("phone", senderPhone(channel, senderKey)).eq("status", "confirmed")
    .order("created_at", { ascending: false }).limit(10);
  if (error) throw new Error("Pesanan tidak dapat dimuat.");
  const orders = await Promise.all(data.map(toManagedOrder));
  return orders.filter((order): order is ManagedOrder => Boolean(order));
}

export type OrderOwner = { sender: { channel: Channel; key: string } } | { code: string } | { buyerUserId: string };

/** Pesanan website milik pembeli yang login, terbaru dulu. */
export async function listOrdersForBuyer(userId: string): Promise<ManagedOrder[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("orders").select(orderColumns)
    .eq("buyer_user_id", userId).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error("Pesanan tidak dapat dimuat.");
  const orders = await Promise.all(data.map(toManagedOrder));
  return orders.filter((order): order is ManagedOrder => Boolean(order));
}

/** Validasi jumlah dilakukan RPC setelah cek kepemilikan dan status batch, sehingga urutan error sama dengan adapter memory. */
export async function manageOrder(id: string, owner: OrderOwner, action: "update" | "cancel", quantity: number | null) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("manage_group_order", {
    p_order_id: id,
    p_phone: "sender" in owner ? senderPhone(owner.sender.channel, owner.sender.key) : null,
    p_management_code_hash: "code" in owner ? hashCode(owner.code) : null,
    p_buyer_user_id: "buyerUserId" in owner ? owner.buyerUserId : null,
    p_action: action,
    p_quantity: quantity,
  });
  if (error) throw new Error(rpcMessage(error.message, action === "update" ? "Pesanan tidak dapat diubah." : "Pesanan tidak dapat dibatalkan."));
}

export type DemandInterestInput = {
  channel: "website" | Channel;
  senderKey: string;
  material: string;
  quantity: number | null;
  unit: string | null;
  frequency: Frequency | null;
};

export async function recordDemandInterest(input: DemandInterestInput): Promise<{ id: string }> {
  const material = input.material.trim();
  if (material.length < 2 || material.length > 120) throw new Error("Nama bahan harus 2 sampai 120 karakter.");
  if (input.quantity !== null && !isValidQuantity(input.quantity)) throw new Error(INVALID_QUANTITY_MESSAGE);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("record_demand_interest", {
    p_channel: input.channel,
    p_sender_key: input.senderKey,
    p_material: material,
    p_quantity: input.quantity,
    p_unit: input.unit,
    p_frequency: input.frequency,
  });
  if (error) throw new Error(rpcMessage(error.message, "Minat belum dapat dicatat. Coba lagi."));
  return { id: data as string };
}

export async function purgeSimulatorOrders(): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("purge_simulator_orders");
  if (error) throw new Error("Pesanan simulator tidak dapat dihapus.");
  return Number(data);
}
