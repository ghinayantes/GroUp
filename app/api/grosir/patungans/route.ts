import { NextResponse } from "next/server";
import { createBatch, ownedSupplierId, parseBatchInput } from "@/lib/batch-create";
import { guardRole, readJson } from "@/lib/route-guard";

/** Grosir membuka batch untuk supplier miliknya sendiri. */
export async function POST(request: Request) {
  const { user, denied } = await guardRole("grosir");
  if (denied) return denied;
  const supplierId = await ownedSupplierId(user.id);
  if (!supplierId) return NextResponse.json({ error: "Akun ini belum dihubungkan ke supplier. Hubungi admin." }, { status: 403 });
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Data batch tidak valid." }, { status: 400 });
  const { input, error } = parseBatchInput(body);
  if (error) return error;
  return createBatch(input, supplierId, user.id);
}
