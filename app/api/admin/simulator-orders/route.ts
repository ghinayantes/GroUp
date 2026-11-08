import { NextResponse } from "next/server";
import { guardAdmin } from "@/lib/admin-route";
import { purgeSimulatorOrders } from "@/lib/orders";

export async function DELETE() {
  const denied = await guardAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json({ deleted: await purgeSimulatorOrders() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pesanan simulator tidak dapat dihapus." }, { status: 500 });
  }
}
