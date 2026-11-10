import type { Batch, BatchStatus, PriceTier } from "@/lib/batch";

/** Harga pasar terakhir per komoditas PIHPS, dipakai supaya harga batch demo masuk akal. */
export type MarketRow = { komoditas: string; harga_terakhir: number; satuan: string };

type Payment = "not_due" | "due" | "paid" | "refunded";
type Fulfillment = "pending" | "ready" | "collected" | "delivered";

type BatchSpec = {
  commodity: string;
  name: string;
  category: string;
  minimum: number;
  status: Exclude<BatchStatus, "cancelled">;
  closesInHours: number;
  fillers: number[];
  buyer: { quantity: number; payment: Payment; fulfillment: Fulfillment } | null;
  fillerProgress?: { payment: Payment; fulfillment: Fulfillment };
};

const SPECS: BatchSpec[] = [
  { commodity: "cabai_merah_keriting", name: "Cabai Merah Keriting", category: "Sayuran", minimum: 100, status: "open", closesInHours: 72, fillers: [12, 8, 15, 20, 9], buyer: { quantity: 5, payment: "not_due", fulfillment: "pending" } },
  { commodity: "bawang_merah", name: "Bawang Merah", category: "Sayuran", minimum: 80, status: "open", closesInHours: 120, fillers: [10, 6, 14], buyer: null },
  { commodity: "telur_ayam_ras", name: "Telur Ayam Ras", category: "Protein", minimum: 150, status: "open", closesInHours: 48, fillers: [30, 25, 20, 40, 15], buyer: { quantity: 10, payment: "not_due", fulfillment: "pending" } },
  { commodity: "daging_ayam_ras", name: "Daging Ayam Ras", category: "Protein", minimum: 120, status: "open", closesInHours: 144, fillers: [10, 12], buyer: null },
  { commodity: "beras_medium", name: "Beras Medium", category: "Bahan kering", minimum: 200, status: "successful", closesInHours: -240, fillers: [50, 60, 40, 35], buyer: { quantity: 20, payment: "due", fulfillment: "pending" }, fillerProgress: { payment: "due", fulfillment: "pending" } },
  { commodity: "gula_pasir", name: "Gula Pasir", category: "Bahan kering", minimum: 100, status: "successful", closesInHours: -480, fillers: [30, 25, 40], buyer: { quantity: 15, payment: "paid", fulfillment: "ready" }, fillerProgress: { payment: "paid", fulfillment: "ready" } },
  { commodity: "minyak_goreng_curah", name: "Minyak Goreng Curah", category: "Bahan kering", minimum: 100, status: "successful", closesInHours: -720, fillers: [40, 30, 25], buyer: { quantity: 8, payment: "paid", fulfillment: "collected" }, fillerProgress: { payment: "paid", fulfillment: "collected" } },
  { commodity: "bawang_putih", name: "Bawang Putih", category: "Sayuran", minimum: 100, status: "failed", closesInHours: -360, fillers: [20, 15], buyer: { quantity: 3, payment: "not_due", fulfillment: "pending" } },
];

const FILLER_NAMES = ["Warung Bu Sari", "Kedai Raka", "Katering Melati", "Seblak Teh Wulan", "Dapur Pak Ujang", "Bakso Mang Adi", "Nasi Uduk Bu Eni"];

const INTEREST_SPECS: { material: string; unit: string | null; frequency: "sekali" | "mingguan" | "bulanan"; quantity: number; senders: number[]; ageDays: number[] }[] = [
  { material: "cabe merah keriting", unit: "kg", frequency: "mingguan", quantity: 8, senders: [1, 2, 3], ageDays: [2, 5, 9] },
  { material: "cabai keriting", unit: "kg", frequency: "mingguan", quantity: 12, senders: [4, 5], ageDays: [3, 11] },
  { material: "cabe keriting", unit: "kg", frequency: "bulanan", quantity: 30, senders: [6], ageDays: [20] },
  { material: "bawmer", unit: "kg", frequency: "mingguan", quantity: 5, senders: [2, 7], ageDays: [4, 18] },
  { material: "bawang merah", unit: "kg", frequency: "bulanan", quantity: 20, senders: [8, 9, 10], ageDays: [6, 16, 24] },
  { material: "telor ayam", unit: "kg", frequency: "mingguan", quantity: 15, senders: [3, 11, 12], ageDays: [1, 8, 13] },
  { material: "telur ayam ras", unit: "tray", frequency: "mingguan", quantity: 4, senders: [13, 14], ageDays: [10, 22] },
  { material: "terigu", unit: "sak", frequency: "bulanan", quantity: 3, senders: [1, 5, 9, 15], ageDays: [2, 7, 15, 26] },
  { material: "gula pasir", unit: "kg", frequency: "bulanan", quantity: 25, senders: [6, 10, 12], ageDays: [5, 12, 19] },
  { material: "gula", unit: "kg", frequency: "sekali", quantity: 50, senders: [14], ageDays: [3] },
  { material: "minyak goreng", unit: "liter", frequency: "mingguan", quantity: 10, senders: [4, 8], ageDays: [6, 21] },
  { material: "minyak goreng curah", unit: "kg", frequency: "mingguan", quantity: 9, senders: [11], ageDays: [9] },
  { material: "daging sapi", unit: "kg", frequency: "bulanan", quantity: 10, senders: [7], ageDays: [14] },
  { material: "beras medium", unit: "kg", frequency: "mingguan", quantity: 25, senders: [13, 15, 2], ageDays: [1, 4, 17] },
  { material: "bawang putih", unit: "kg", frequency: "bulanan", quantity: 6, senders: [3, 6], ageDays: [8, 25] },
  { material: "cabe rawit", unit: "kg", frequency: "mingguan", quantity: 3, senders: [9, 12, 15], ageDays: [2, 6, 27] },
];

/**
 * Persen harga pasar untuk tier 1 dan tier 2. Patungan hanya memangkas sebagian margin
 * perdagangan dan pengangkutan (MPP) BPS: cabai ±25%, bawang merah ±23%, daging ayam ±12%,
 * beras/minyak/gula/telur ±9–11%. Tier 1 ±⅓ MPP, tier 2 ±½ MPP.
 */
const TIER_PCT: Record<string, [number, number]> = {
  cabai_merah_keriting: [92, 88],
  bawang_merah: [93, 89],
  bawang_putih: [93, 89],
  daging_ayam_ras: [96, 94],
  telur_ayam_ras: [97, 95],
  beras_medium: [97, 95],
  gula_pasir: [97, 95],
  minyak_goreng_curah: [97, 95],
};

export const DEMO_SENDER_PREFIX = "demo-seed-";

/** Dibulatkan ke bawah ke Rp100. */
export const priceAt = (market: number, pct: number) => Math.floor((market * pct) / 100 / 100) * 100;

export type PlannedOrder = {
  id: string;
  patungan_id: string;
  customer_name: string;
  phone: string;
  quantity: number;
  channel: "website" | "whatsapp";
  status: "confirmed";
  management_code_hash: string | null;
  buyer_user_id: string | null;
  final_unit_price: number | null;
  payment_status: Payment;
  fulfillment_status: Fulfillment;
  created_at: string;
  demo_seed: Record<string, unknown>;
};

export type DemoPlan = {
  batches: (Record<string, unknown> & { id: string })[];
  tiers: { patungan_id: string; min_quantity: number; unit_price: number }[];
  orders: PlannedOrder[];
  interests: Record<string, unknown>[];
  /** Batch terbuka dalam bentuk yang dipakai engine agen untuk simulasi trace. */
  openBatches: Batch[];
};

type PlanInput = {
  market: MarketRow[];
  now: Date;
  supplierId: string;
  supplierName: string;
  grosirId: string;
  buyerId: string;
  uuid: () => string;
  codeHash: () => string;
};

const hoursFrom = (now: Date, hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString();

export function buildDemoPlan(input: PlanInput): DemoPlan {
  const { now, uuid } = input;
  const plan: DemoPlan = { batches: [], tiers: [], orders: [], interests: [], openBatches: [] };
  let fillerIndex = 0;

  for (const spec of SPECS) {
    const market = input.market.find((row) => row.komoditas === spec.commodity);
    if (!market) throw new Error(`Harga pasar ${spec.commodity} tidak ada di prediksi.json`);
    const id = uuid();
    const tiers: PriceTier[] = [
      { minQuantity: spec.minimum, unitPrice: priceAt(market.harga_terakhir, TIER_PCT[spec.commodity][0]) },
      { minQuantity: Math.round(spec.minimum * 1.5), unitPrice: priceAt(market.harga_terakhir, TIER_PCT[spec.commodity][1]) },
    ];
    const quantities = [...spec.fillers, ...(spec.buyer ? [spec.buyer.quantity] : [])];
    const total = quantities.reduce((sum, quantity) => sum + quantity, 0);
    if (spec.status === "successful" && total < spec.minimum) throw new Error(`${spec.name}: total ${total} di bawah minimum`);
    if (spec.status !== "successful" && spec.status !== "open" && total >= spec.minimum) throw new Error(`${spec.name}: batch gagal tidak boleh mencapai minimum`);
    const finalPrice = spec.status === "successful" ? tiers.filter((tier) => tier.minQuantity <= total).at(-1)!.unitPrice : null;
    const finalQuantity = spec.status === "open" ? null : total;
    const closesAt = hoursFrom(now, spec.closesInHours);
    const payment = spec.status === "successful" ? spec.fillerProgress ?? { payment: "due" as const, fulfillment: "pending" as const } : { payment: "not_due" as const, fulfillment: "pending" as const };
    const createdAt = (offsetHours: number) => hoursFrom(now, Math.min(spec.closesInHours, 0) - 96 + offsetHours);

    plan.batches.push({
      id,
      supplier_id: input.supplierId,
      material_name: spec.name,
      category: spec.category,
      unit: market.satuan,
      image_url: null,
      min_quantity: spec.minimum,
      closes_at: closesAt,
      payment_instructions: "Tagihan dikirim lewat WhatsApp setelah batch berhasil. Transfer ke rekening Grosir Demo paling lambat 2 hari.",
      fulfillment_plan: "Ambil di gudang Grosir Demo, Jl. Contoh No. 1 Bandung, Sabtu 08.00–11.00.",
      status: spec.status,
      final_quantity: finalQuantity,
      final_unit_price: finalPrice,
      created_by: input.grosirId,
      created_at: createdAt(0),
      demo_seed: { status: spec.status, closes_in: `${spec.closesInHours} hours`, final_quantity: finalQuantity, final_unit_price: finalPrice },
    });
    tiers.forEach((tier) => plan.tiers.push({ patungan_id: id, min_quantity: tier.minQuantity, unit_price: tier.unitPrice }));

    const pushOrder = (order: Omit<PlannedOrder, "id" | "patungan_id" | "status" | "final_unit_price" | "demo_seed">) => {
      const row = { ...order, id: uuid(), patungan_id: id, status: "confirmed" as const, final_unit_price: finalPrice };
      plan.orders.push({ ...row, demo_seed: { status: row.status, quantity: row.quantity, final_unit_price: finalPrice, payment_status: row.payment_status, fulfillment_status: row.fulfillment_status } });
    };
    spec.fillers.forEach((quantity, index) => {
      fillerIndex += 1;
      pushOrder({
        customer_name: FILLER_NAMES[fillerIndex % FILLER_NAMES.length],
        phone: `62800000${String(fillerIndex).padStart(4, "0")}`,
        quantity,
        channel: "whatsapp",
        management_code_hash: null,
        buyer_user_id: null,
        payment_status: payment.payment,
        fulfillment_status: payment.fulfillment,
        created_at: createdAt(index * 6 + 2),
      });
    });
    if (spec.buyer) {
      pushOrder({
        customer_name: "Pembeli Demo",
        phone: "080000000001",
        quantity: spec.buyer.quantity,
        channel: "website",
        management_code_hash: input.codeHash(),
        buyer_user_id: input.buyerId,
        payment_status: spec.buyer.payment,
        fulfillment_status: spec.buyer.fulfillment,
        created_at: createdAt(1),
      });
    }

    if (spec.status === "open") {
      plan.openBatches.push({
        id, name: spec.name, category: spec.category, unit: market.satuan, supplierId: input.supplierId, supplier: input.supplierName, verified: true, supplierCompletedBatches: 3,
        image: "", color: "#ead7c4", current: total, minimum: spec.minimum, closesAt, status: "open", acceptingOrders: true, tiers,
        paymentInstructions: "", fulfillmentPlan: "", finalUnitPrice: null, fairPrice: null,
      });
    }
  }

  for (const spec of INTEREST_SPECS) {
    spec.senders.forEach((sender, index) => {
      const ageHours = spec.ageDays[index] * 24 + sender;
      plan.interests.push({
        id: uuid(),
        channel: "whatsapp",
        sender_key: `${DEMO_SENDER_PREFIX}${String(sender).padStart(2, "0")}`,
        material: spec.material,
        quantity: spec.quantity,
        unit: spec.unit,
        frequency: spec.frequency,
        status: "active",
        created_at: hoursFrom(now, -ageHours),
        demo_seed: { age: `${ageHours} hours` },
      });
    });
  }
  return plan;
}
