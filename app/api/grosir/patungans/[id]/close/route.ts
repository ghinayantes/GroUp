import { NextResponse } from "next/server";
import { closeBatch, ownsBatch } from "@/lib/batch-create";
import { badId, guardRole } from "@/lib/route-guard";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Context) {
  const { user, denied } = await guardRole("grosir");
  if (denied) return denied;
  const { id } = await params;
  const invalid = badId(id);
  if (invalid) return invalid;
  if (!await ownsBatch(user.id, id)) return NextResponse.json({ error: "Batch tidak ditemukan." }, { status: 404 });
  return closeBatch(id);
}
