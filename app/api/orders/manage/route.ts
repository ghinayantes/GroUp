import { NextResponse } from "next/server";
import { cancelOrderByCode, findOrderByCode, updateOrderByCode } from "@/lib/orders";

async function readBody(request: Request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

const notFound = () => NextResponse.json({ error: "Pesanan tidak ditemukan. Periksa kode pengelolaan." }, { status: 404 });
const failure = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: message.includes("belum aktif") ? 503 : 400 });
};

/** POST { managementCode } → detail pesanan website milik pemegang kode. */
export async function POST(request: Request) {
  const body = await readBody(request);
  if (typeof body?.managementCode !== "string") return NextResponse.json({ error: "Masukkan kode pengelolaan." }, { status: 400 });
  try {
    const order = await findOrderByCode(body.managementCode);
    return order ? NextResponse.json({ order }) : notFound();
  } catch (error) {
    return failure(error, "Pesanan tidak dapat dimuat.");
  }
}

/** PATCH { managementCode, quantity } → ubah jumlah selama batch masih terbuka. */
export async function PATCH(request: Request) {
  const body = await readBody(request);
  if (typeof body?.managementCode !== "string" || typeof body.quantity !== "number") {
    return NextResponse.json({ error: "Kode pengelolaan dan jumlah diperlukan." }, { status: 400 });
  }
  try {
    await updateOrderByCode(body.managementCode, body.quantity);
    return NextResponse.json({ order: await findOrderByCode(body.managementCode) });
  } catch (error) {
    return failure(error, "Pesanan tidak dapat diubah.");
  }
}

/** DELETE { managementCode } → batalkan pesanan selama batch masih terbuka. */
export async function DELETE(request: Request) {
  const body = await readBody(request);
  if (typeof body?.managementCode !== "string") return NextResponse.json({ error: "Kode pengelolaan diperlukan." }, { status: 400 });
  try {
    await cancelOrderByCode(body.managementCode);
    return NextResponse.json({ order: await findOrderByCode(body.managementCode) });
  } catch (error) {
    return failure(error, "Pesanan tidak dapat dibatalkan.");
  }
}
