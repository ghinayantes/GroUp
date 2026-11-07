import { NextResponse } from "next/server";
import { badId, guardAdmin } from "@/lib/admin-route";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

/** Menutup batch: di bawah minimum → gagal tanpa tagihan; mencapai minimum → harga final dibekukan dan pembayaran jatuh tempo. */
export async function POST(_request: Request, { params }: Context) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id } = await params;
  const invalid = badId(id);
  if (invalid) return invalid;
  const { data, error } = await createSupabaseAdminClient().rpc("close_group_batch", { p_patungan_id: id });
  if (error) {
    const message = error.message.includes("batch_not_open") ? "Batch sudah ditutup." : "Batch belum dapat ditutup.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ result: data });
}
