import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/test/fake-supabase";
import { createOrder, listOrdersForSender, manageOrder, purgeSimulatorOrders } from "./orders";

vi.mock("@/lib/supabase/server", async () => {
  const { fakeSupabase } = await import("@/test/fake-supabase");
  return { createSupabaseAdminClient: () => fakeSupabase.client, hasSupabaseSecret: () => true };
});

const BATCH_ID = "00000000-0000-4000-8000-000000000001";

beforeEach(() => fakeSupabase.reset());

describe("lib/orders", () => {
  it("createOrder website tetap membuat kode pengelolaan", async () => {
    fakeSupabase.respond(() => ({ data: "order-1" }));
    const result = await createOrder({ groupId: BATCH_ID, customerName: "Sari", phone: "0812-3456-7890", quantity: 2 });
    expect(result.managementCode).toEqual(expect.any(String));
    const [call] = fakeSupabase.calls;
    expect(call.args).toMatchObject({ p_channel: "website", p_phone: "081234567890", p_management_code_hash: expect.any(String) });
  });

  it("createOrder simulator menerima sender key non-nomor", async () => {
    fakeSupabase.respond(() => ({ data: "order-2" }));
    const result = await createOrder({ groupId: BATCH_ID, customerName: "Pengunjung simulator", phone: "sim-0123456789abcdef", quantity: 1, channel: "simulator", providerMessageId: "m1" });
    expect(result).toEqual({ id: "order-2", managementCode: null });
    expect(fakeSupabase.calls[0].args).toMatchObject({ p_channel: "simulator", p_phone: "sim-0123456789abcdef", p_management_code_hash: null });
  });

  it("createOrder whatsapp tetap menolak nomor tidak valid", async () => {
    await expect(createOrder({ groupId: BATCH_ID, customerName: "Sari", phone: "sim-0123456789abcdef", quantity: 1, channel: "whatsapp" })).rejects.toThrow("Periksa nama");
    expect(fakeSupabase.calls).toHaveLength(0);
  });

  it("listOrdersForSender memfilter kanal whatsapp dan nomor ternormalisasi", async () => {
    fakeSupabase.respond(() => ({ data: [] }));
    await listOrdersForSender("whatsapp", "62 812-3456");
    const [call] = fakeSupabase.calls;
    expect(Object.fromEntries(fakeSupabase.op(call, "eq"))).toEqual({ channel: "whatsapp", phone: "628123456", status: "confirmed" });
  });

  it("listOrdersForSender simulator memakai sender key apa adanya", async () => {
    fakeSupabase.respond(() => ({ data: [] }));
    await listOrdersForSender("simulator", "sim-0123456789abcdef");
    const [call] = fakeSupabase.calls;
    expect(Object.fromEntries(fakeSupabase.op(call, "eq"))).toEqual({ channel: "simulator", phone: "sim-0123456789abcdef", status: "confirmed" });
  });

  it("manageOrder simulator memakai sender key apa adanya, website tetap lewat kode", async () => {
    await manageOrder("order-1", { channel: "simulator", key: "sim-0123456789abcdef" }, null, "cancel", null);
    await manageOrder("order-1", null, "kode", "cancel", null);
    expect(fakeSupabase.calls[0].args).toMatchObject({ p_phone: "sim-0123456789abcdef", p_management_code_hash: null });
    expect(fakeSupabase.calls[1].args).toMatchObject({ p_phone: null, p_management_code_hash: expect.any(String) });
  });

  it("purgeSimulatorOrders memanggil purge_simulator_orders dan mengembalikan jumlah", async () => {
    fakeSupabase.respond(() => ({ data: 51 }));
    expect(await purgeSimulatorOrders()).toBe(51);
    expect(fakeSupabase.calls[0].rpc).toBe("purge_simulator_orders");
  });

  it("purgeSimulatorOrders melempar pesan Indonesia bila gagal", async () => {
    fakeSupabase.respond(() => ({ error: { message: "permission denied" } }));
    await expect(purgeSimulatorOrders()).rejects.toThrow("Pesanan simulator tidak dapat dihapus.");
  });
});
