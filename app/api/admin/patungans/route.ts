import { NextResponse } from "next/server";
import { createBatch, parseBatchInput } from "@/lib/batch-create";
import { guardRole, readJson } from "@/lib/route-guard";
import { isUuid } from "@/lib/uuid";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/** Membuat batch untuk supplier mana pun: body batch + { supplierId }. */
export async function POST(request: Request) {
  const { user, denied } = await guardRole("admin");
  if (denied) return denied;
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Data batch tidak valid." }, { status: 400 });
  const supplierId = typeof body.supplierId === "string" ? body.supplierId.trim() : "";
  if (!isUuid(supplierId)) return NextResponse.json({ error: "Pilih supplier." }, { status: 400 });
  const { input, error } = parseBatchInput(body);
  if (error) return error;

  const { data: supplier } = await createSupabaseAdminClient().from("suppliers").select("id").eq("id", supplierId).maybeSingle();
  if (!supplier) return NextResponse.json({ error: "Supplier tidak ditemukan." }, { status: 400 });
  return createBatch(input, supplierId, user.id);
}
