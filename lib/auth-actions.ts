"use server";

import { redirect } from "next/navigation";
import { isRole, landingPath, ROLE_HOME, ROLE_LABEL, userFromClaims, type Role } from "@/lib/roles";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";

export type SignInState = { error: string } | null;

const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

async function signInAndRedirect(email: string, password: string, chosen: Role | null, next: string | null): Promise<SignInState> {
  if (!hasSupabaseConfig()) return { error: "Login belum aktif. Lengkapi konfigurasi Supabase." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "Email atau kata sandi salah." };
  const user = userFromClaims({ sub: data.user.id, email: data.user.email, app_metadata: data.user.app_metadata });
  if (!user) {
    await supabase.auth.signOut();
    return { error: "Akun ini belum punya peran. Hubungi admin GroUp." };
  }
  redirect(chosen && chosen !== user.role ? `${ROLE_HOME[user.role]}?info=peran-berbeda` : landingPath(user.role, next));
}

export async function signIn(_state: SignInState, form: FormData): Promise<SignInState> {
  const email = field(form, "email");
  const password = form.get("password");
  if (!email || typeof password !== "string" || !password) return { error: "Isi email dan kata sandi." };
  const chosen = field(form, "peran");
  return signInAndRedirect(email, password, isRole(chosen) ? chosen : null, field(form, "lanjut") || null);
}

/** Login akun demo dengan kredensial dari env server; kata sandi tidak pernah dikirim ke browser. */
export async function signInAsDemo(role: unknown): Promise<SignInState> {
  if (!isRole(role)) return { error: "Peran demo tidak dikenal." };
  const prefix = `DEMO_${role.toUpperCase()}`;
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) {
    console.error(`${prefix}_EMAIL atau ${prefix}_PASSWORD belum diisi`);
    return { error: `Akun demo ${ROLE_LABEL[role]} belum disiapkan. Coba peran lain atau hubungi tim GroUp.` };
  }
  return signInAndRedirect(email, password, role, null);
}

export async function signInAsDemoForm(_state: SignInState, form: FormData): Promise<SignInState> {
  return signInAsDemo(form.get("role"));
}

export async function signOut() {
  if (hasSupabaseConfig()) await (await createSupabaseServerClient()).auth.signOut();
  redirect("/");
}
