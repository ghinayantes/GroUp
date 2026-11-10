import { NextResponse } from "next/server";
import { manageOrder } from "@/lib/orders";
import { badId, guardRole, readJson } from "@/lib/route-guard";

type Context = { params: Promise<{ id: string }> };

async function run(request: Request, { params }: Context, action: "update" | "cancel") {
  const { user, denied } = await guardRole("pembeli");
  if (denied) return denied;
  const { id } = await params;
  const invalid = badId(id);
  if (invalid) return invalid;
  let quantity: number | null = null;
  if (action === "update") {
    const body = await readJson(request);
    if (typeof body?.quantity !== "number") return NextResponse.json({ error: "Jumlah diperlukan." }, { status: 400 });
    quantity = body.quantity;
  }
  try {
    await manageOrder(id, { buyerUserId: user.id }, action, quantity);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pesanan tidak dapat diproses.";
    return NextResponse.json({ error: message }, { status: message.includes("tidak ditemukan") ? 404 : 400 });
  }
}

/** PATCH { quantity }: ubah jumlah pesanan milik pembeli yang login selama batch masih terbuka. */
export const PATCH = (request: Request, context: Context) => run(request, context, "update");

/** DELETE: batalkan pesanan milik pembeli yang login selama batch masih terbuka. */
export const DELETE = (request: Request, context: Context) => run(request, context, "cancel");
