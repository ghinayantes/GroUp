import { NextResponse } from "next/server";
import { BATCH_IMAGE_BUCKET, batchImagePath } from "@/lib/batch-image";
import { guardRole } from "@/lib/route-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST() {
  const { user, denied } = await guardRole("admin", "grosir");
  if (denied) return denied;

  const path = batchImagePath(user.id, crypto.randomUUID());
  const { data, error } = await createSupabaseAdminClient().storage.from(BATCH_IMAGE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: "Tautan upload belum dapat dibuat." }, { status: 502 });

  return NextResponse.json({ path, token: data.token }, { status: 201 });
}
