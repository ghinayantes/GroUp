import { describe, expect, it } from "vitest";
import { FIXTURE_BATCHES, FIXTURE_NOW } from "@/test/fixtures/batches";
import { senderHash } from "../ports";
import { createMemoryDeps } from "./memory";

const cabai = FIXTURE_BATCHES[0];
const gula = FIXTURE_BATCHES.find((b) => b.name === "Gula Pasir")!;

const newOrder = (batchId = cabai.id, overrides: Partial<Parameters<ReturnType<typeof createMemoryDeps>["orders"]["createOrder"]>[0]> = {}) => ({
  batchId, channel: "whatsapp" as const, senderKey: "6281", customerName: "Sari", quantity: 5, messageId: "m1", ...overrides,
});

describe("memory adapter", () => {
  it("createOrder menolak batch yang sudah tutup", async () => {
    const deps = createMemoryDeps({ batches: FIXTURE_BATCHES, now: FIXTURE_NOW });
    await expect(deps.orders.createOrder(newOrder(gula.id))).rejects.toThrow("sudah ditutup");
  });

  it("createOrder menolak jumlah tidak valid", async () => {
    const deps = createMemoryDeps({ batches: FIXTURE_BATCHES, now: FIXTURE_NOW });
    await expect(deps.orders.createOrder(newOrder(cabai.id, { quantity: 0 }))).rejects.toThrow("Jumlah harus lebih dari nol dan maksimal 100.000.");
  });

  it("manageOrder menolak senderKey lain", async () => {
    const deps = createMemoryDeps({ batches: FIXTURE_BATCHES, now: FIXTURE_NOW });
    const { id } = await deps.orders.createOrder(newOrder());
    await expect(deps.orders.manageOrder({ orderId: id, channel: "whatsapp", senderKey: "6299", action: "cancel", quantity: null })).rejects.toThrow("tidak ditemukan");
  });

  it("listOrders hanya mengembalikan pesanan confirmed milik pengirim", async () => {
    const deps = createMemoryDeps({ batches: FIXTURE_BATCHES, now: FIXTURE_NOW });
    const mine = await deps.orders.createOrder(newOrder(cabai.id, { messageId: "a" }));
    const cancelled = await deps.orders.createOrder(newOrder(FIXTURE_BATCHES[1].id, { messageId: "b" }));
    await deps.orders.createOrder(newOrder(cabai.id, { senderKey: "6299", messageId: "c" }));
    await deps.orders.manageOrder({ orderId: cancelled.id, channel: "whatsapp", senderKey: "6281", action: "cancel", quantity: null });

    const orders = await deps.orders.listOrders("whatsapp", "6281");
    expect(orders.map((o) => o.id)).toEqual([mine.id]);
    expect(orders[0]).toMatchObject({
      customerName: "Sari", quantity: 5, status: "confirmed", paymentStatus: "not_due", fulfillmentStatus: "pending",
      finalUnitPrice: null, editable: true,
    });
    expect(orders[0].batch.id).toBe(cabai.id);
  });

  it("writes mencatat setiap penulisan", async () => {
    const deps = createMemoryDeps({ batches: FIXTURE_BATCHES, now: FIXTURE_NOW });
    const { id } = await deps.orders.createOrder(newOrder());
    await deps.orders.manageOrder({ orderId: id, channel: "whatsapp", senderKey: "6281", action: "update", quantity: 8 });
    await deps.orders.recordInterest({ channel: "whatsapp", senderKey: "6281", material: "Telur Ayam", quantity: 10, unit: "kg", frequency: "mingguan" });
    expect(deps.writes.map((w) => w.kind)).toEqual(["create", "update", "interest"]);
    expect(deps.state.orders[0].quantity).toBe(8);
    expect(deps.state.interests).toHaveLength(1);
  });

  it("recordInterest menolak bahan di luar 2-120 karakter", async () => {
    const deps = createMemoryDeps({ batches: FIXTURE_BATCHES, now: FIXTURE_NOW });
    await expect(deps.orders.recordInterest({ channel: "whatsapp", senderKey: "6281", material: " a ", quantity: null, unit: null, frequency: null })).rejects.toThrow();
  });

  it("createOrder dengan messageId sama idempoten", async () => {
    const deps = createMemoryDeps({ batches: FIXTURE_BATCHES, now: FIXTURE_NOW });
    const first = await deps.orders.createOrder(newOrder());
    const second = await deps.orders.createOrder(newOrder());
    expect(second.id).toBe(first.id);
    expect(deps.state.orders).toHaveLength(1);
    expect(deps.writes).toHaveLength(1);
  });

  it("simulator dibatasi 50 pesanan confirmed per batch", async () => {
    const deps = createMemoryDeps({ batches: FIXTURE_BATCHES, now: FIXTURE_NOW });
    for (let i = 0; i < 50; i++) {
      await deps.orders.createOrder(newOrder(cabai.id, { channel: "simulator", senderKey: `s${i}`, messageId: `m${i}` }));
    }
    await expect(deps.orders.createOrder(newOrder(cabai.id, { channel: "simulator", senderKey: "s50", messageId: "m50" }))).rejects.toThrow("Batas pesanan simulator untuk batch ini sudah penuh.");
    await expect(deps.orders.createOrder(newOrder(cabai.id, { channel: "whatsapp", messageId: "wa" }))).resolves.toBeDefined();
  });

  it("listOpenBatches hanya batch yang menerima pesanan dengan current dari pesanan confirmed", async () => {
    const deps = createMemoryDeps({ batches: FIXTURE_BATCHES, now: FIXTURE_NOW });
    await deps.orders.createOrder(newOrder(cabai.id, { quantity: 5, messageId: "a" }));
    const b = await deps.orders.createOrder(newOrder(cabai.id, { quantity: 7, messageId: "b" }));
    const c = await deps.orders.createOrder(newOrder(cabai.id, { quantity: 20, messageId: "c" }));
    await deps.orders.manageOrder({ orderId: c.id, channel: "whatsapp", senderKey: "6281", action: "cancel", quantity: null });

    const open = await deps.orders.listOpenBatches();
    expect(open.map((x) => x.name)).not.toContain("Gula Pasir");
    expect(open).toHaveLength(4);
    expect(open.find((x) => x.id === cabai.id)?.current).toBe(12);
    expect(b.id).toBeTruthy();
  });

  it("countStage2Since menghitung trace stage2 sejak waktu tertentu", async () => {
    let now = FIXTURE_NOW;
    const deps = createMemoryDeps({ batches: FIXTURE_BATCHES, now: FIXTURE_NOW });
    deps.now = () => now;
    const trace = { stage: "stage2" as const, intent: null, confidence: null, action: "answer" as const, model: "m", inputTokens: null, outputTokens: null, latencyMs: 1 };
    const hash = senderHash("whatsapp", "6281");
    await deps.traces.record("whatsapp", hash, trace);
    now = new Date(FIXTURE_NOW.getTime() + 3_600_000);
    await deps.traces.record("whatsapp", hash, trace);
    await deps.traces.record("whatsapp", hash, { ...trace, stage: "stage1" });
    expect(await deps.traces.countStage2Since(hash, FIXTURE_NOW)).toBe(2);
    expect(await deps.traces.countStage2Since(hash, now)).toBe(1);
  });

  it("semua pembacaan waktu mengikuti deps.now terbaru", async () => {
    const deps = createMemoryDeps({ batches: FIXTURE_BATCHES, now: FIXTURE_NOW });
    const later = new Date(FIXTURE_NOW.getTime() + 7_200_000);
    deps.now = () => later;
    await deps.orders.createOrder(newOrder());
    await deps.history.append("whatsapp", "6281", { role: "user", content: "hai", aiGenerated: false });
    expect(deps.state.orders[0].createdAt).toBe(later.toISOString());
    expect(deps.writes[0].at).toBe(later.getTime());
    expect((await deps.history.recent("whatsapp", "6281", 5))[0].at).toBe(later.toISOString());
  });

  it("senderHash deterministik dan berbeda per kanal", () => {
    expect(senderHash("whatsapp", "6281")).toBe(senderHash("whatsapp", "6281"));
    expect(senderHash("whatsapp", "6281")).not.toBe(senderHash("simulator", "6281"));
    expect(senderHash("whatsapp", "6281")).toMatch(/^[0-9a-f]{64}$/);
  });
});
