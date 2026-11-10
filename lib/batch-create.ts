import "server-only";
import { NextResponse } from "next/server";
import { BATCH_IMAGE_BUCKET, isOwnedImagePath } from "@/lib/batch-image";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export type BatchInput = {
  name: string;
  category: string;
  unit: string;
  imagePath: string;
  minimum: number;
  closesAt: Date;
  tiers: { minQuantity: number; unitPrice: number }[];
  paymentInstructions: string;
  fulfillmentPlan: string;
};

const fail = (error: string) => ({ input: null, error: NextResponse.json({ error }, { status: 400 }) });

/** Body: { name, category, unit, imagePath?, minimum, closesAt, tiers: [{ minQuantity, unitPrice }], paymentInstructions, fulfillmentPlan } */
export function parseBatchInput(body: Record<string, unknown>): { input: BatchInput; error: null } | { input: null; error: NextResponse } {
  const name = text(body.name, 160);
  const category = text(body.category, 60);
  const unit = text(body.unit, 20);
  const paymentInstructions = text(body.paymentInstructions, 1000);
  const fulfillmentPlan = text(body.fulfillmentPlan, 1000);
  const imagePath = text(body.imagePath, 200);
  const minimum = body.minimum;
  const closesAt = typeof body.closesAt === "string" ? new Date(body.closesAt) : null;

  if (name.length < 2 || !category || !unit || typeof minimum !== "number" || !(minimum > 0) || !closesAt || Number.isNaN(closesAt.getTime())) {
    return fail("Lengkapi bahan, kategori, satuan, kuota minimum, dan deadline.");
  }
  if (closesAt.getTime() <= Date.now()) return fail("Deadline harus di masa depan.");
  if (!paymentInstructions || !fulfillmentPlan) {
    return fail("Aturan pembayaran dan rencana penyerahan wajib diisi agar terlihat sebelum pembeli berkomitmen.");
  }
  if (!Array.isArray(body.tiers) || body.tiers.length === 0 || body.tiers.length > 6) return fail("Isi 1–6 tier harga.");
  const tiers = (body.tiers as Array<Record<string, unknown>>)
    .map((tier) => ({ minQuantity: Number(tier?.minQuantity), unitPrice: Number(tier?.unitPrice) }))
    .sort((a, b) => a.minQuantity - b.minQuantity);
  const invalidTier = tiers.some((tier, index) => !(tier.minQuantity > 0) || !(tier.unitPrice > 0)
    || (index > 0 && (tier.minQuantity <= tiers[index - 1].minQuantity || tier.unitPrice >= tiers[index - 1].unitPrice)));
  if (invalidTier) return fail("Ambang kuantitas harus naik dan harga per unit harus turun di setiap tier.");
  if (tiers[0].minQuantity > minimum) return fail("Tier pertama harus berlaku pada atau di bawah kuota minimum.");

  return { input: { name, category, unit, imagePath, minimum, closesAt, tiers, paymentInstructions, fulfillmentPlan }, error: null };
}

export async function createBatch(input: BatchInput, supplierId: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  let imageUrl: string | null = null;
  if (input.imagePath) {
    if (!isOwnedImagePath(input.imagePath, userId)) return NextResponse.json({ error: "Gambar tidak valid." }, { status: 400 });
    const bucket = supabase.storage.from(BATCH_IMAGE_BUCKET);
    const uploaded = await bucket.exists(input.imagePath).then(({ data, error }) => !error && data, () => false);
    if (!uploaded) return NextResponse.json({ error: "Gambar belum terupload." }, { status: 400 });
    imageUrl = bucket.getPublicUrl(input.imagePath).data.publicUrl;
  }

  const { data: id, error } = await supabase.rpc("create_group_batch", {
    p_supplier_id: supplierId,
    p_material_name: input.name,
    p_category: input.category,
    p_unit: input.unit,
    p_image_url: imageUrl,
    p_min_quantity: input.minimum,
    p_closes_at: input.closesAt.toISOString(),
    p_payment_instructions: input.paymentInstructions,
    p_fulfillment_plan: input.fulfillmentPlan,
    p_tiers: input.tiers.map((tier) => ({ min_quantity: tier.minQuantity, unit_price: tier.unitPrice })),
    p_created_by: userId,
  });
  if (error) return NextResponse.json({ error: "Batch belum dapat dibuat. Pastikan migrasi Supabase sudah diterapkan." }, { status: 400 });
  return NextResponse.json({ id }, { status: 201 });
}

/** Supplier milik akun grosir; null bila akun belum dihubungkan admin. */
export async function ownedSupplierId(userId: string): Promise<string | null> {
  const { data } = await createSupabaseAdminClient().from("suppliers").select("id").eq("owner_user_id", userId).maybeSingle();
  return data?.id ?? null;
}

/** Batch hanya boleh disentuh grosir bila suppliernya dimiliki akun tersebut. */
export async function ownsBatch(userId: string, batchId: string): Promise<boolean> {
  const { data } = await createSupabaseAdminClient().from("patungans").select("id, suppliers!inner(owner_user_id)")
    .eq("id", batchId).eq("suppliers.owner_user_id", userId).maybeSingle();
  return Boolean(data);
}

/** Menutup batch: di bawah minimum → gagal tanpa tagihan; mencapai minimum → harga final dibekukan dan pembayaran jatuh tempo. */
export async function closeBatch(batchId: string) {
  const { data, error } = await createSupabaseAdminClient().rpc("close_group_batch", { p_patungan_id: batchId });
  if (error) {
    const message = error.message.includes("batch_not_open") ? "Batch sudah ditutup." : "Batch belum dapat ditutup.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ result: data });
}
