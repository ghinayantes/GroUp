import { NextResponse } from "next/server";
import { guardRole, readJson } from "@/lib/route-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/** Menambah supplier baru; status verifikasi ditetapkan terpisah setelah pemeriksaan manual. */
export async function POST(request: Request) {
  const { denied } = await guardRole("admin");
  if (denied) return denied;
  const body = await readJson(request);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 120) return NextResponse.json({ error: "Nama supplier 2–120 karakter." }, { status: 400 });
  const { data, error } = await createSupabaseAdminClient().from("suppliers").insert({ display_name: name }).select("id").single();
  if (error) return NextResponse.json({ error: "Supplier belum dapat ditambahkan." }, { status: 400 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
