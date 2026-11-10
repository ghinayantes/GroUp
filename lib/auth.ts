import "server-only";
import { redirect } from "next/navigation";
import { ROLE_HOME, userFromClaims, type CurrentUser, type Role } from "@/lib/roles";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";

export async function currentUser(): Promise<CurrentUser | null> {
  if (!hasSupabaseConfig()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  return error ? null : userFromClaims(data?.claims);
}

/** Untuk halaman dashboard: proxy sudah mengalihkan, ini lapis kedua sebelum data dimuat dengan service role. */
export async function requireRole(role: Role): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect(`/masuk?peran=${role}`);
  if (user.role !== role) redirect(ROLE_HOME[user.role]);
  return user;
}
