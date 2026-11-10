import "server-only";
import { NextResponse } from "next/server";
import { isUuid } from "@/lib/uuid";
import { hasSupabaseSecret, isCurrentUserAdmin } from "@/lib/supabase/server";

/** Mengembalikan respons error bila permintaan bukan dari admin; null bila boleh lanjut. */
export async function guardAdmin() {
  if (!hasSupabaseSecret()) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  if (!await isCurrentUserAdmin()) return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  return null;
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
