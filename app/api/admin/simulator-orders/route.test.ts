import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/route-guard", () => ({ guardRole: vi.fn() }));
vi.mock("@/lib/orders", () => ({ purgeSimulatorOrders: vi.fn() }));

const { DELETE } = await import("./route");
const { guardRole } = await import("@/lib/route-guard");
const ADMIN = { user: { id: "a1", role: "admin" as const, demo: false, email: null }, denied: null };
const { purgeSimulatorOrders } = await import("@/lib/orders");

beforeEach(() => {
  vi.mocked(guardRole).mockReset();
  vi.mocked(purgeSimulatorOrders).mockReset();
});

describe("DELETE /api/admin/simulator-orders", () => {
  it("bukan admin ditolak tanpa menghapus", async () => {
    vi.mocked(guardRole).mockResolvedValue({ user: null, denied: NextResponse.json({ error: "Akses ditolak." }, { status: 403 }) });

    const response = await DELETE();

    expect(response.status).toBe(403);
    expect(purgeSimulatorOrders).not.toHaveBeenCalled();
  });

  it("admin menghapus dan menerima jumlahnya", async () => {
    vi.mocked(guardRole).mockResolvedValue(ADMIN);
    vi.mocked(purgeSimulatorOrders).mockResolvedValue(4);

    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 4 });
  });

  it("kegagalan database dibalas 500", async () => {
    vi.mocked(guardRole).mockResolvedValue(ADMIN);
    vi.mocked(purgeSimulatorOrders).mockRejectedValue(new Error("Pesanan simulator tidak dapat dihapus."));

    const response = await DELETE();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Pesanan simulator tidak dapat dihapus." });
  });
});
