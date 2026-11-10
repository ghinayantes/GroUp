import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function hasSupabaseSecret() {
  return Boolean(hasSupabaseConfig() && process.env.SUPABASE_SECRET_KEY);
}

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase belum dikonfigurasi. Isi URL dan SUPABASE_SECRET_KEY di .env.local.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase belum dikonfigurasi.");
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies; proxy.ts refreshes the session.
        }
      },
    },
  });
}

export async function isCurrentUserAdmin() {
  if (!hasSupabaseConfig()) return false;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  return !error && data?.claims?.app_metadata?.role === "admin";
}

export async function currentUserId() {
  if (!hasSupabaseConfig()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return !error && typeof sub === "string" ? sub : null;
}
