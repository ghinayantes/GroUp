import "server-only";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import type { CurrentUser, Role } from "@/lib/roles";
import { isUuid } from "@/lib/uuid";
import { hasSupabaseSecret } from "@/lib/supabase/server";

export type Guarded = { user: CurrentUser; denied: null } | { user: null; denied: NextResponse };

export async function guardRole(...roles: Role[]): Promise<Guarded> {
  if (!hasSupabaseSecret()) return { user: null, denied: NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 }) };
  const user = await currentUser();
  if (!user || !roles.includes(user.role)) {
    return { user: null, denied: NextResponse.json({ error: "Akses ditolak. Masuk dengan akun yang sesuai." }, { status: 403 }) };
  }
  return { user, denied: null };
}

export async function readJson(request: Request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export const badId = (id: string) => (isUuid(id) ? null : NextResponse.json({ error: "ID tidak valid." }, { status: 400 }));
