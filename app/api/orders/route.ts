import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createOrder } from "@/lib/orders";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Format pesanan tidak valid." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Format pesanan tidak valid." }, { status: 400 });
  const input = body as Record<string, unknown>;
  if (typeof input.groupId !== "string" || typeof input.customerName !== "string" || typeof input.phone !== "string" || typeof input.quantity !== "number") {
    return NextResponse.json({ error: "Lengkapi data pesanan terlebih dahulu." }, { status: 400 });
  }
  try {
    const user = await currentUser();
    const result = await createOrder({
      groupId: input.groupId,
      customerName: input.customerName,
      phone: input.phone,
      quantity: input.quantity,
      buyerUserId: user?.role === "pembeli" ? user.id : null,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pesanan belum dapat diproses.";
    return NextResponse.json({ error: message }, { status: message.includes("belum aktif") ? 503 : 400 });
  }
}
