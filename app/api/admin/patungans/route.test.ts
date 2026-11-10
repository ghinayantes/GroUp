import { beforeEach, describe, expect, it, vi } from "vitest";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const SUPPLIER = "33333333-3333-4333-8333-333333333333";
const IMAGE = "44444444-4444-4444-8444-444444444444";

const guardRole = vi.fn();
const rpc = vi.fn();
const exists = vi.fn();
const getPublicUrl = vi.fn();
const maybeSingle = vi.fn();
const storageFrom = vi.fn(() => ({ exists, getPublicUrl }));

vi.mock("@/lib/route-guard", async () => {
  const actual = await vi.importActual<typeof import("@/lib/route-guard")>("@/lib/route-guard");
  return { ...actual, guardRole: (...roles: string[]) => guardRole(...roles) };
});
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    rpc,
    storage: { from: storageFrom },
  }),
}));

const { POST } = await import("./route");

function validBody(extra: Record<string, unknown> = {}) {
  return {
    supplierId: SUPPLIER,
    name: "Tepung Terigu",
    category: "Bahan pokok",
    unit: "kg",
    minimum: 100,
    closesAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    tiers: [{ minQuantity: 100, unitPrice: 10000 }],
    paymentInstructions: "Transfer ke rekening koperasi.",
    fulfillmentPlan: "Ambil di gudang.",
    ...extra,
  };
}

function post(body: Record<string, unknown>) {
  return POST(new Request("http://localhost/api/admin/patungans", { method: "POST", body: JSON.stringify(body) }));
}

beforeEach(() => {
  guardRole.mockReset();
  rpc.mockReset();
  exists.mockReset();
  getPublicUrl.mockReset();
  maybeSingle.mockReset();
  storageFrom.mockClear();
  guardRole.mockResolvedValue({ user: { id: USER, role: "admin", demo: false, email: null }, denied: null });
  maybeSingle.mockResolvedValue({ data: { id: SUPPLIER } });
  rpc.mockResolvedValue({ data: "id", error: null });
  exists.mockResolvedValue({ data: true, error: null });
  getPublicUrl.mockImplementation((path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }));
});

describe("POST /api/admin/patungans", () => {
  it("hanya untuk admin", async () => {
    const { NextResponse } = await import("next/server");
    guardRole.mockResolvedValue({ user: null, denied: NextResponse.json({ error: "x" }, { status: 403 }) });

    const response = await post(validBody());

    expect(response.status).toBe(403);
    expect(guardRole).toHaveBeenCalledWith("admin");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("tanpa imagePath → 201 dan p_image_url null", async () => {
    const response = await post(validBody());

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("create_group_batch", expect.objectContaining({ p_image_url: null, p_created_by: USER }));
    expect(exists).not.toHaveBeenCalled();
  });

  it("imagePath milik user → 201 dan p_image_url = publicUrl dari getPublicUrl", async () => {
    const path = `${USER}/${IMAGE}.webp`;

    const response = await post(validBody({ imagePath: path }));

    expect(response.status).toBe(201);
    expect(storageFrom).toHaveBeenCalledWith("batch-images");
    expect(exists).toHaveBeenCalledWith(path);
    expect(getPublicUrl).toHaveBeenCalledWith(path);
    expect(rpc).toHaveBeenCalledWith("create_group_batch", expect.objectContaining({ p_image_url: `https://cdn.test/${path}` }));
  });

  it("imagePath milik user lain → 400 dan rpc tidak dipanggil", async () => {
    const response = await post(validBody({ imagePath: `${OTHER}/${IMAGE}.webp` }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Gambar tidak valid." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("imagePath dengan ../ → 400 Gambar tidak valid.", async () => {
    const response = await post(validBody({ imagePath: `${USER}/../${IMAGE}.webp` }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Gambar tidak valid." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("exists → { data: false } → 400 Gambar belum terupload.", async () => {
    exists.mockResolvedValue({ data: false, error: null });

    const response = await post(validBody({ imagePath: `${USER}/${IMAGE}.webp` }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Gambar belum terupload." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("exists melempar error jaringan → 400 Gambar belum terupload.", async () => {
    exists.mockRejectedValue(new TypeError("fetch failed"));

    const response = await post(validBody({ imagePath: `${USER}/${IMAGE}.webp` }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Gambar belum terupload." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("exists mengembalikan error → 400 Gambar belum terupload.", async () => {
    exists.mockResolvedValue({ data: null, error: { message: "boom" } });

    const response = await post(validBody({ imagePath: `${USER}/${IMAGE}.webp` }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Gambar belum terupload." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("body dengan imageUrl saja diabaikan → p_image_url null", async () => {
    const response = await post(validBody({ imageUrl: "https://example.com/a.jpg" }));

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("create_group_batch", expect.objectContaining({ p_image_url: null }));
  });
});
