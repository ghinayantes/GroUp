import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/roles";
import { createFakeSupabase } from "@/test/fake-supabase";

const BUYER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MY_ORDER = "11111111-1111-4111-8111-111111111111";
const OTHER_ORDER = "22222222-2222-4222-8222-222222222222";

const fake = createFakeSupabase();
const currentUser = vi.fn<() => Promise<CurrentUser | null>>();

vi.mock("@/lib/auth", () => ({ currentUser: () => currentUser() }));
vi.mock("@/lib/supabase/server", () => ({
  hasSupabaseSecret: () => true,
  createSupabaseAdminClient: () => fake.client,
}));

const { PATCH, DELETE } = await import("./route");

const context = (id: string) => ({ params: Promise.resolve({ id }) });
const patch = (id: string, body: unknown) => PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) }), context(id));

beforeEach(() => {
  fake.reset();
  currentUser.mockReset();
  currentUser.mockResolvedValue({ id: BUYER, role: "pembeli", demo: false, email: null });
  fake.respond((call) => (call.args?.p_order_id === MY_ORDER ? {} : { error: { message: "order_not_found" } }));
});

describe("/api/akun/orders/[id]", () => {
  it("hanya untuk pembeli", async () => {
    currentUser.mockResolvedValue({ id: BUYER, role: "grosir", demo: false, email: null });
    expect((await patch(MY_ORDER, { quantity: 3 })).status).toBe(403);
    expect(fake.calls).toHaveLength(0);
  });

  it("mengubah pesanan miliknya dengan buyer id dari sesi", async () => {
    const response = await patch(MY_ORDER, { quantity: 3, buyerUserId: "orang-lain" });

    expect(response.status).toBe(200);
    expect(fake.calls[0].args).toMatchObject({ p_order_id: MY_ORDER, p_buyer_user_id: BUYER, p_phone: null, p_management_code_hash: null, p_action: "update", p_quantity: 3 });
  });

  it("pesanan pembeli lain → 404", async () => {
    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), context(OTHER_ORDER));

    expect(response.status).toBe(404);
    expect(fake.calls[0].args).toMatchObject({ p_buyer_user_id: BUYER, p_action: "cancel" });
  });

  it("tanpa jumlah → 400", async () => {
    expect((await patch(MY_ORDER, {})).status).toBe(400);
  });
});
