import { NextResponse } from "next/server";
import { badId, guardRole, readJson } from "@/lib/route-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

const LINK_ERRORS: Record<string, string> = {
  grosir_not_found: "Tidak ada akun grosir dengan email itu. Isi kata sandi untuk membuat akun baru.",
  owner_taken: "Akun ini sudah terhubung ke supplier lain.",
  supplier_not_found: "Supplier tidak ditemukan.",
};

/** { email, password? }: tanpa kata sandi menghubungkan akun grosir yang ada; dengan kata sandi membuat akun grosir baru dulu. */
export async function POST(request: Request, { params }: Context) {
  const { denied } = await guardRole("admin");
  if (denied) return denied;
  const { id } = await params;
  const invalid = badId(id);
  if (invalid) return invalid;
  const body = await readJson(request);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });
  if (password && password.length < 8) return NextResponse.json({ error: "Kata sandi minimal 8 karakter." }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  if (password) {
    const { error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: "grosir" } });
    if (error) return NextResponse.json({ error: error.code === "email_exists" ? "Email sudah terdaftar. Kosongkan kata sandi untuk menghubungkan akun itu." : "Akun grosir belum dapat dibuat." }, { status: 400 });
  }
  const { error } = await supabase.rpc("link_supplier_owner", { p_supplier_id: id, p_email: email });
  if (error) {
    const code = Object.keys(LINK_ERRORS).find((key) => error.message.includes(key));
    return NextResponse.json({ error: code ? LINK_ERRORS[code] : "Akun grosir belum dapat dihubungkan." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
