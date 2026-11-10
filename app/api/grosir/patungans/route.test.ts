import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/roles";
import { createFakeSupabase, type FakeCall } from "@/test/fake-supabase";

const GROSIR_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GROSIR_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SUPPLIER_A = "33333333-3333-4333-8333-333333333333";
const BATCH_OF_B = "44444444-4444-4444-8444-444444444444";

const fake = createFakeSupabase();
const currentUser = vi.fn<() => Promise<CurrentUser | null>>();

vi.mock("@/lib/auth", () => ({ currentUser: () => currentUser() }));
vi.mock("@/lib/supabase/server", () => ({
  hasSupabaseSecret: () => true,
  createSupabaseAdminClient: () => fake.client,
}));

const { POST: createBatch } = await import("./route");
const { POST: closeBatch } = await import("./[id]/close/route");

const grosir = (id: string): CurrentUser => ({ id, role: "grosir", demo: false, email: null });
const eqs = (call: FakeCall) => Object.fromEntries(fake.op(call, "eq").map(([column, value]) => [column, value]));

function body(extra: Record<string, unknown> = {}) {
  return {
    name: "Cabai Merah Keriting",
    category: "Sayuran",
    unit: "kg",
    minimum: 100,
    closesAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    tiers: [{ minQuantity: 100, unitPrice: 40000 }],
    paymentInstructions: "Transfer setelah batch berhasil.",
    fulfillmentPlan: "Ambil di gudang.",
    ...extra,
  };
}

const post = (payload: Record<string, unknown>) =>
  createBatch(new Request("http://localhost/api/grosir/patungans", { method: "POST", body: JSON.stringify(payload) }));
const close = (id: string) => closeBatch(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id }) });

beforeEach(() => {
  fake.reset();
  currentUser.mockReset();
  currentUser.mockResolvedValue(grosir(GROSIR_A));
  fake.respond((call) => {
    if (call.table === "suppliers") return { data: eqs(call).owner_user_id === GROSIR_A ? { id: SUPPLIER_A } : null };
    if (call.table === "patungans") return { data: eqs(call)["suppliers.owner_user_id"] === GROSIR_B && eqs(call).id === BATCH_OF_B ? { id: BATCH_OF_B } : null };
    if (call.rpc === "create_group_batch") return { data: "new-batch" };
    if (call.rpc === "close_group_batch") return { data: "successful" };
    return {};
  });
});

describe("POST /api/grosir/patungans", () => {
  it("admin dan pembeli ditolak", async () => {
    for (const role of ["admin", "pembeli"] as const) {
      currentUser.mockResolvedValue({ ...grosir(GROSIR_A), role });
      expect((await post(body())).status).toBe(403);
    }
    expect(fake.calls.some((call) => call.rpc)).toBe(false);
  });

  it("batch dibuat untuk supplier milik grosir, bukan supplierId dari body", async () => {
    const response = await post(body({ supplierId: "99999999-9999-4999-8999-999999999999" }));

    expect(response.status).toBe(201);
    const rpc = fake.calls.find((call) => call.rpc === "create_group_batch");
    expect(rpc?.args).toMatchObject({ p_supplier_id: SUPPLIER_A, p_created_by: GROSIR_A });
  });

  it("grosir tanpa supplier → 403", async () => {
    currentUser.mockResolvedValue(grosir(GROSIR_B));

    const response = await post(body());

    expect(response.status).toBe(403);
    expect(fake.calls.some((call) => call.rpc)).toBe(false);
  });
});

describe("POST /api/grosir/patungans/[id]/close", () => {
  it("grosir A ditolak saat menutup batch grosir B", async () => {
    const response = await close(BATCH_OF_B);

    expect(response.status).toBe(404);
    expect(fake.calls.some((call) => call.rpc === "close_group_batch")).toBe(false);
  });

  it("pemilik batch boleh menutup", async () => {
    currentUser.mockResolvedValue(grosir(GROSIR_B));

    const response = await close(BATCH_OF_B);

    expect(response.status).toBe(200);
    expect(fake.calls.find((call) => call.rpc === "close_group_batch")?.args).toEqual({ p_patungan_id: BATCH_OF_B });
  });
});
