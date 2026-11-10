import { NextResponse } from "next/server";
import { badId, guardRole, readJson } from "@/lib/route-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

/** Verifikasi manual: { verified, note } */
export async function PATCH(request: Request, { params }: Context) {
  const { denied } = await guardRole("admin");
  if (denied) return denied;
  const { id } = await params;
  const invalid = badId(id);
  if (invalid) return invalid;
  const body = await readJson(request);
  if (typeof body?.verified !== "boolean") return NextResponse.json({ error: "Status verifikasi diperlukan." }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  const { error } = await createSupabaseAdminClient().from("suppliers").update({
    is_verified: body.verified,
    verification_note: note,
    verified_at: body.verified ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) return NextResponse.json({ error: "Verifikasi belum dapat disimpan." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
