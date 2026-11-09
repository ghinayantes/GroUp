import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, type FakeCall } from "@/test/fake-supabase";
import { senderHash } from "../ports";
import type { AgentSession, TraceRecord } from "../types";
import { createSupabaseDeps } from "./supabase";

vi.mock("@/lib/supabase/server", async () => {
  const { fakeSupabase } = await import("@/test/fake-supabase");
  return { createSupabaseAdminClient: () => fakeSupabase.client, hasSupabaseSecret: () => true };
});

const BATCH_ID = "00000000-0000-4000-8000-000000000001";
const ORDER_ID = "00000000-0000-4000-8000-0000000000aa";
const SIM_KEY = "sim-0123456789abcdef";

const batchRow = {
  id: BATCH_ID,
  material_name: "Cabai Merah Keriting",
  category: "Sayur & Bumbu",
  unit: "kg",
  image_url: null,
  min_quantity: "100",
  closes_at: "2999-01-01T00:00:00.000Z",
  status: "open",
  payment_instructions: "",
  fulfillment_plan: "",
  final_unit_price: null,
  final_quantity: null,
  supplier_id: "s1",
  suppliers: { display_name: "Mitra", is_verified: true },
  patungan_price_tiers: [{ min_quantity: "1", unit_price: "40000" }],
};

const eqs = (call: FakeCall) => Object.fromEntries(fakeSupabase.op(call, "eq").map(([column, value]) => [column, value]));
const only = (predicate: (call: FakeCall) => boolean) => {
  const matches = fakeSupabase.calls.filter(predicate);
  expect(matches).toHaveLength(1);
  return matches[0];
};
const rpcError = (message: string) => () => ({ error: { message } });

beforeEach(() => fakeSupabase.reset());

describe("supabase adapter: orders", () => {
  it("listOrders memfilter kanal, pengirim, dan status confirmed", async () => {
    fakeSupabase.respond((call) => {
      if (call.table === "orders" && eqs(call).phone) {
        return { data: [{ id: ORDER_ID, patungan_id: BATCH_ID, customer_name: "Pengunjung simulator", quantity: "2.5", status: "confirmed", payment_status: "not_due", fulfillment_status: "pending", final_unit_price: null, created_at: "2026-11-06T00:00:00Z" }] };
      }
      if (call.table === "patungans" && fakeSupabase.op(call, "maybeSingle").length) return { data: batchRow };
      return { data: [] };
    });
    const orders = await createSupabaseDeps().orders.listOrders("simulator", SIM_KEY);
    const query = only((call) => call.table === "orders" && Boolean(eqs(call).phone));
    expect(eqs(query)).toEqual({ channel: "simulator", phone: SIM_KEY, status: "confirmed" });
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ id: ORDER_ID, quantity: 2.5, status: "confirmed", editable: true, batch: { id: BATCH_ID, name: "Cabai Merah Keriting" } });
  });

  it("createOrder memanggil create_group_order tanpa kode pengelolaan", async () => {
    fakeSupabase.respond(() => ({ data: ORDER_ID }));
    const result = await createSupabaseDeps().orders.createOrder({ batchId: BATCH_ID, channel: "simulator", senderKey: SIM_KEY, customerName: "Pengunjung simulator", quantity: 3, messageId: "msg-1" });
    expect(result).toEqual({ id: ORDER_ID });
    const call = only((c) => c.rpc === "create_group_order");
    expect(call.args).toEqual({
      p_patungan_id: BATCH_ID,
      p_customer_name: "Pengunjung simulator",
      p_phone: SIM_KEY,
      p_quantity: 3,
      p_channel: "simulator",
      p_management_code_hash: null,
      p_provider_message_id: "msg-1",
    });
  });

  it("createOrder memetakan error RPC ke pesan yang sama dengan memory adapter", async () => {
    const deps = createSupabaseDeps();
    const input = { batchId: BATCH_ID, channel: "simulator" as const, senderKey: SIM_KEY, customerName: "Pengunjung simulator", quantity: 3, messageId: "msg-1" };
    fakeSupabase.respond(rpcError("simulator_limit"));
    await expect(deps.orders.createOrder(input)).rejects.toThrow("Batas pesanan simulator untuk batch ini sudah penuh.");
    fakeSupabase.respond(rpcError("batch_closed"));
    await expect(deps.orders.createOrder(input)).rejects.toThrow("Batch ini sudah ditutup. Pesanan tidak dapat dibuat atau diubah.");
    fakeSupabase.respond(rpcError("invalid_order"));
    await expect(deps.orders.createOrder(input)).rejects.toThrow("Jumlah harus lebih dari nol dan maksimal 100.000.");
  });

  it("createOrder menolak batch bukan UUID dan jumlah tidak valid tanpa memanggil RPC", async () => {
    const deps = createSupabaseDeps();
    const input = { batchId: BATCH_ID, channel: "whatsapp" as const, senderKey: "6281234567890", customerName: "Sari", quantity: 3, messageId: "msg-1" };
    await expect(deps.orders.createOrder({ ...input, batchId: "bukan-uuid" })).rejects.toThrow("sudah ditutup");
    await expect(deps.orders.createOrder({ ...input, quantity: 0 })).rejects.toThrow("Jumlah harus lebih dari nol dan maksimal 100.000.");
    await expect(deps.orders.createOrder({ ...input, quantity: 1.0001 })).rejects.toThrow("Jumlah harus lebih dari nol dan maksimal 100.000.");
    expect(fakeSupabase.calls).toHaveLength(0);
  });

  it("manageOrder memakai senderKey sebagai p_phone dan memetakan error", async () => {
    const deps = createSupabaseDeps();
    await deps.orders.manageOrder({ orderId: ORDER_ID, channel: "whatsapp", senderKey: "6281234567890", action: "update", quantity: 8 });
    expect(only((c) => c.rpc === "manage_group_order").args).toEqual({
      p_order_id: ORDER_ID,
      p_phone: "6281234567890",
      p_management_code_hash: null,
      p_action: "update",
      p_quantity: 8,
    });
    fakeSupabase.respond(rpcError("order_not_found"));
    await expect(deps.orders.manageOrder({ orderId: ORDER_ID, channel: "whatsapp", senderKey: "6299", action: "cancel", quantity: null })).rejects.toThrow("Pesanan tidak ditemukan. Periksa kode pengelolaan.");
    fakeSupabase.respond(rpcError("invalid_action"));
    await expect(deps.orders.manageOrder({ orderId: ORDER_ID, channel: "whatsapp", senderKey: "6281234567890", action: "update", quantity: null })).rejects.toThrow("Jumlah harus lebih dari nol dan maksimal 100.000.");
  });

  it("manageOrder simulator meneruskan sender key apa adanya", async () => {
    await createSupabaseDeps().orders.manageOrder({ orderId: ORDER_ID, channel: "simulator", senderKey: SIM_KEY, action: "cancel", quantity: null });
    expect(only((c) => c.rpc === "manage_group_order").args).toMatchObject({ p_phone: SIM_KEY, p_action: "cancel", p_quantity: null });
  });

  it("manageOrder whatsapp menormalisasi nomor", async () => {
    await createSupabaseDeps().orders.manageOrder({ orderId: ORDER_ID, channel: "whatsapp", senderKey: "62 812-3456-7890", action: "cancel", quantity: null });
    expect(only((c) => c.rpc === "manage_group_order").args).toMatchObject({ p_phone: "6281234567890" });
  });

  it("manageOrder menolak orderId bukan UUID sebagai tidak ditemukan", async () => {
    await expect(createSupabaseDeps().orders.manageOrder({ orderId: "ABC123", channel: "simulator", senderKey: SIM_KEY, action: "cancel", quantity: null })).rejects.toThrow("tidak ditemukan");
    expect(fakeSupabase.calls).toHaveLength(0);
  });

  it("recordInterest memanggil record_demand_interest dengan sender key asli", async () => {
    fakeSupabase.respond(() => ({ data: "interest-1" }));
    const result = await createSupabaseDeps().orders.recordInterest({ channel: "simulator", senderKey: SIM_KEY, material: "  Bawang Merah ", quantity: 10, unit: "kg", frequency: "mingguan" });
    expect(result).toEqual({ id: "interest-1" });
    expect(only((c) => c.rpc === "record_demand_interest").args).toEqual({
      p_channel: "simulator",
      p_sender_key: SIM_KEY,
      p_material: "Bawang Merah",
      p_quantity: 10,
      p_unit: "kg",
      p_frequency: "mingguan",
    });
  });

  it("recordInterest menolak bahan dan jumlah tidak valid seperti memory adapter", async () => {
    const deps = createSupabaseDeps();
    const input = { channel: "whatsapp" as const, senderKey: "6281", material: "Bawang", quantity: null, unit: null, frequency: null };
    await expect(deps.orders.recordInterest({ ...input, material: " a " })).rejects.toThrow("Nama bahan harus 2 sampai 120 karakter.");
    await expect(deps.orders.recordInterest({ ...input, quantity: -1 })).rejects.toThrow("Jumlah harus lebih dari nol dan maksimal 100.000.");
    expect(fakeSupabase.calls).toHaveLength(0);
  });
});

describe("supabase adapter: sessions", () => {
  const session: AgentSession = {
    channel: "simulator",
    senderKey: SIM_KEY,
    stage: "confirm_order",
    batchId: BATCH_ID,
    quantity: 2.5,
    customerName: "Pengunjung simulator",
    pendingAction: { type: "confirm_join", batchId: BATCH_ID, quantity: 2.5 },
    expiresAt: "2026-11-07T00:00:00.000Z",
  };

  it("get memfilter kanal dan phone lalu memetakan kolom", async () => {
    fakeSupabase.respond(() => ({
      data: { phone: SIM_KEY, channel: "simulator", stage: "confirm_order", patungan_id: BATCH_ID, quantity: "2.500", customer_name: "Pengunjung simulator", pending_action: session.pendingAction, expires_at: session.expiresAt },
    }));
    expect(await createSupabaseDeps().sessions.get("simulator", SIM_KEY)).toEqual(session);
    const call = only((c) => c.table === "whatsapp_sessions");
    expect(eqs(call)).toEqual({ channel: "simulator", phone: SIM_KEY });
    expect(fakeSupabase.op(call, "maybeSingle")).toHaveLength(1);
  });

  it("get mengembalikan null bila sesi tidak ada", async () => {
    expect(await createSupabaseDeps().sessions.get("whatsapp", "6281")).toBeNull();
  });

  it("save melakukan upsert dengan onConflict phone", async () => {
    await createSupabaseDeps().sessions.save(session);
    const [[row, options]] = fakeSupabase.op(only((c) => c.table === "whatsapp_sessions"), "upsert") as [[Record<string, unknown>, unknown]];
    expect(options).toEqual({ onConflict: "phone" });
    expect(row).toMatchObject({
      phone: SIM_KEY,
      channel: "simulator",
      stage: "confirm_order",
      patungan_id: BATCH_ID,
      quantity: 2.5,
      customer_name: "Pengunjung simulator",
      pending_action: session.pendingAction,
      expires_at: session.expiresAt,
    });
    expect(typeof row.updated_at).toBe("string");
  });

  it("save melempar error bila upsert gagal", async () => {
    fakeSupabase.respond(rpcError("boom"));
    await expect(createSupabaseDeps().sessions.save(session)).rejects.toThrow("Sesi percakapan tidak dapat disimpan.");
  });

  it("remove menghapus berdasarkan kanal dan phone", async () => {
    await createSupabaseDeps().sessions.remove("whatsapp", "6281");
    const call = only((c) => c.table === "whatsapp_sessions");
    expect(fakeSupabase.op(call, "delete")).toHaveLength(1);
    expect(eqs(call)).toEqual({ channel: "whatsapp", phone: "6281" });
  });
});

describe("supabase adapter: history", () => {
  it("recent mengambil pesan terbaru lalu mengurutkannya kronologis", async () => {
    fakeSupabase.respond(() => ({
      data: [
        { role: "assistant", content: "Halo juga", ai_generated: true, created_at: "2026-11-06T00:00:02Z" },
        { role: "user", content: "Halo", ai_generated: false, created_at: "2026-11-06T00:00:01Z" },
      ],
    }));
    const entries = await createSupabaseDeps().history.recent("whatsapp", "6281", 6);
    expect(entries).toEqual([
      { role: "user", content: "Halo", aiGenerated: false, at: "2026-11-06T00:00:01Z" },
      { role: "assistant", content: "Halo juga", aiGenerated: true, at: "2026-11-06T00:00:02Z" },
    ]);
    const call = only((c) => c.table === "agent_messages");
    expect(eqs(call)).toEqual({ channel: "whatsapp", sender_key: "6281" });
    expect(fakeSupabase.op(call, "order")).toEqual([["created_at", { ascending: false }]]);
    expect(fakeSupabase.op(call, "limit")).toEqual([[6]]);
  });

  it("append menyimpan ai_generated", async () => {
    await createSupabaseDeps().history.append("simulator", SIM_KEY, { role: "assistant", content: "Jawaban", aiGenerated: true });
    expect(fakeSupabase.op(only((c) => c.table === "agent_messages"), "insert")).toEqual([
      [{ channel: "simulator", sender_key: SIM_KEY, role: "assistant", content: "Jawaban", ai_generated: true }],
    ]);
  });

  it("append memotong isi menjadi 2000 karakter sesuai batas kolom", async () => {
    await createSupabaseDeps().history.append("whatsapp", "6281", { role: "user", content: "x".repeat(2500), aiGenerated: false });
    const [[row]] = fakeSupabase.op(only((c) => c.table === "agent_messages"), "insert") as [[{ content: string }]];
    expect(row.content).toHaveLength(2000);
  });
});

describe("supabase adapter: traces", () => {
  const trace: TraceRecord = {
    stage: "stage2",
    intent: "tanya_info",
    confidence: 0.81234,
    action: "answer",
    model: "openai/gpt-5-mini",
    inputTokens: 120,
    outputTokens: 40,
    latencyMs: 812.6,
    slots: { material: "cabai" },
    tools: ["daftar_batch"],
  };

  it("record menyimpan sender_hash tanpa slots, tools, atau sender asli", async () => {
    const hash = senderHash("whatsapp", "6281");
    await createSupabaseDeps().traces.record("whatsapp", hash, trace);
    const [[row]] = fakeSupabase.op(only((c) => c.table === "agent_traces"), "insert") as [[Record<string, unknown>]];
    expect(row).toEqual({
      channel: "whatsapp",
      sender_hash: hash,
      stage: "stage2",
      intent: "tanya_info",
      confidence: 0.81234,
      action: "answer",
      model: "openai/gpt-5-mini",
      input_tokens: 120,
      output_tokens: 40,
      latency_ms: 813,
    });
    expect(JSON.stringify(row)).not.toContain("6281");
  });

  it("countStage2Since menghitung trace yang memanggil model sejak waktu tertentu", async () => {
    fakeSupabase.respond(() => ({ count: 7 }));
    const since = new Date("2026-11-06T01:00:00.000Z");
    expect(await createSupabaseDeps().traces.countStage2Since("abc", since)).toBe(7);
    const call = only((c) => c.table === "agent_traces");
    expect(fakeSupabase.op(call, "select")).toEqual([["id", { count: "exact", head: true }]]);
    expect(eqs(call)).toEqual({ sender_hash: "abc" });
    expect(fakeSupabase.op(call, "not")).toEqual([["model", "is", null]]);
    expect(fakeSupabase.op(call, "gte")).toEqual([["created_at", since.toISOString()]]);
  });
});

describe("supabase adapter: market price", () => {
  it("lookup belum punya data dan mengembalikan null", async () => {
    expect(await createSupabaseDeps().marketPrice.lookup("cabai", null)).toBeNull();
  });
});
