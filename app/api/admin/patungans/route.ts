import { NextResponse } from "next/server";
import { guardAdmin, readJson } from "@/lib/admin-route";
import { BATCH_IMAGE_BUCKET, isOwnedImagePath } from "@/lib/batch-image";
import { isUuid } from "@/lib/uuid";
import { createSupabaseAdminClient, currentUserId } from "@/lib/supabase/server";

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/**
 * Membuat batch: { supplierId, name, category, unit, imagePath?, minimum, closesAt,
 *   tiers: [{ minQuantity, unitPrice }], paymentInstructions, fulfillmentPlan }
 */
export async function POST(request: Request) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Data batch tidak valid." }, { status: 400 });

  const supplierId = text(body.supplierId, 64);
  const name = text(body.name, 160);
  const category = text(body.category, 60);
  const unit = text(body.unit, 20);
  const paymentInstructions = text(body.paymentInstructions, 1000);
  const fulfillmentPlan = text(body.fulfillmentPlan, 1000);
  const imagePath = text(body.imagePath, 200);
  const minimum = body.minimum;
  const closesAt = typeof body.closesAt === "string" ? new Date(body.closesAt) : null;

  if (!isUuid(supplierId) || name.length < 2 || !category || !unit || typeof minimum !== "number" || !(minimum > 0) || !closesAt || Number.isNaN(closesAt.getTime())) {
    return NextResponse.json({ error: "Lengkapi supplier, bahan, kategori, satuan, kuota minimum, dan deadline." }, { status: 400 });
  }
  if (closesAt.getTime() <= Date.now()) return NextResponse.json({ error: "Deadline harus di masa depan." }, { status: 400 });
  if (!paymentInstructions || !fulfillmentPlan) {
    return NextResponse.json({ error: "Aturan pembayaran dan rencana penyerahan wajib diisi agar terlihat sebelum pembeli berkomitmen." }, { status: 400 });
  }

  if (!Array.isArray(body.tiers) || body.tiers.length === 0 || body.tiers.length > 6) {
    return NextResponse.json({ error: "Isi 1–6 tier harga." }, { status: 400 });
  }
  const tiers = (body.tiers as Array<Record<string, unknown>>).map((tier) => ({ minQuantity: Number(tier?.minQuantity), unitPrice: Number(tier?.unitPrice) }));
  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);
  const invalidTier = sorted.some((tier, index) => !(tier.minQuantity > 0) || !(tier.unitPrice > 0)
    || (index > 0 && (tier.minQuantity <= sorted[index - 1].minQuantity || tier.unitPrice >= sorted[index - 1].unitPrice)));
  if (invalidTier) return NextResponse.json({ error: "Ambang kuantitas harus naik dan harga per unit harus turun di setiap tier." }, { status: 400 });
  if (sorted[0].minQuantity > minimum) return NextResponse.json({ error: "Tier pertama harus berlaku pada atau di bawah kuota minimum." }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: supplier } = await supabase.from("suppliers").select("id").eq("id", supplierId).maybeSingle();
  if (!supplier) return NextResponse.json({ error: "Supplier tidak ditemukan." }, { status: 400 });

  const userId = await currentUserId();
  let imageUrl: string | null = null;
  if (imagePath) {
    if (!userId || !isOwnedImagePath(imagePath, userId)) return NextResponse.json({ error: "Gambar tidak valid." }, { status: 400 });
    const bucket = supabase.storage.from(BATCH_IMAGE_BUCKET);
    const uploaded = await bucket.exists(imagePath).then(({ data, error: existsError }) => !existsError && data, () => false);
    if (!uploaded) return NextResponse.json({ error: "Gambar belum terupload." }, { status: 400 });
    imageUrl = bucket.getPublicUrl(imagePath).data.publicUrl;
  }

  const { data: id, error } = await supabase.rpc("create_group_batch", {
    p_supplier_id: supplierId,
    p_material_name: name,
    p_category: category,
    p_unit: unit,
    p_image_url: imageUrl,
    p_min_quantity: minimum,
    p_closes_at: closesAt.toISOString(),
    p_payment_instructions: paymentInstructions,
    p_fulfillment_plan: fulfillmentPlan,
    p_tiers: sorted.map((tier) => ({ min_quantity: tier.minQuantity, unit_price: tier.unitPrice })),
    p_created_by: userId,
  });
  if (error) return NextResponse.json({ error: "Batch belum dapat dibuat. Pastikan migrasi Supabase sudah diterapkan." }, { status: 400 });
  return NextResponse.json({ id }, { status: 201 });
}
