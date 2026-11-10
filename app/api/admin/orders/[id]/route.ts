import { NextResponse } from "next/server";
import { badId, guardRole, readJson } from "@/lib/route-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

/** Pencatatan manual status pembayaran dan penyerahan per pesanan (hanya batch berhasil). */
export async function PATCH(request: Request, { params }: Context) {
  const { denied } = await guardRole("admin");
  if (denied) return denied;
  const { id } = await params;
  const invalid = badId(id);
  if (invalid) return invalid;
  const body = await readJson(request);
  if (typeof body?.paymentStatus !== "string" || typeof body.fulfillmentStatus !== "string") {
    return NextResponse.json({ error: "Status pembayaran dan penyerahan diperlukan." }, { status: 400 });
  }
  const { error } = await createSupabaseAdminClient().rpc("set_order_progress", {
    p_order_id: id,
    p_payment_status: body.paymentStatus,
    p_fulfillment_status: body.fulfillmentStatus,
  });
  if (error) {
    const message = error.message.includes("batch_not_successful")
      ? "Status pembayaran hanya dapat dicatat untuk batch yang berhasil."
      : "Status pesanan belum dapat disimpan.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
