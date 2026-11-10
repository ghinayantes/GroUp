import { NextResponse } from "next/server";
import { guardAdmin } from "@/lib/admin-route";
import { BATCH_IMAGE_BUCKET, batchImagePath } from "@/lib/batch-image";
import { createSupabaseAdminClient, currentUserId } from "@/lib/supabase/server";

export async function POST() {
  const denied = await guardAdmin();
  if (denied) return denied;

  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });

  const path = batchImagePath(userId, crypto.randomUUID());
  const { data, error } = await createSupabaseAdminClient().storage.from(BATCH_IMAGE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: "Tautan upload belum dapat dibuat." }, { status: 502 });

  return NextResponse.json({ path, token: data.token }, { status: 201 });
}
