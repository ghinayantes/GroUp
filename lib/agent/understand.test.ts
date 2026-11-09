import { describe, expect, it, vi } from "vitest";
import { createMemoryDeps, type MemoryDeps } from "@/lib/agent/adapters/memory";
import { FIXTURE_BATCHES, FIXTURE_NOW } from "@/test/fixtures/batches";
import type { ActionContext } from "./actions";
import { createEngine } from "./engine";
import type { IntentClassifier, IntentScore } from "./ports";
import { BUTTON, type AgentSession, type InboundMessage } from "./types";
import { understandFreeText } from "./understand";

const CABAI = FIXTURE_BATCHES[0];
const SENDER = "sim-0123456789abcdef";

const message = (text: string): InboundMessage => ({ channel: "simulator", senderKey: SENDER, messageId: crypto.randomUUID(), text, kind: "text" });

function fakeClassifier(score: IntentScore, accepted = true): IntentClassifier & { classify: ReturnType<typeof vi.fn> } {
  return { version: "fake", classify: vi.fn(async () => score), accepts: () => accepted };
}

async function setup(overrides: Partial<MemoryDeps> = {}) {
  const deps = Object.assign(createMemoryDeps({ batches: FIXTURE_BATCHES, now: FIXTURE_NOW }), overrides);
  const context = async (msg: InboundMessage): Promise<ActionContext> => ({
    deps,
    msg,
    batches: await deps.orders.listOpenBatches(),
    orders: await deps.orders.listOrders(msg.channel, msg.senderKey),
  });
  return { deps, context };
}

const enterQuantity: AgentSession = {
  channel: "simulator",
  senderKey: SENDER,
  stage: "enter_quantity",
  batchId: CABAI.id,
  quantity: null,
  customerName: null,
  pendingAction: null,
  expiresAt: new Date(FIXTURE_NOW.getTime() + 3_600_000).toISOString(),
};

describe("understandFreeText tahap 1", () => {
  it('"mau ikut cabe 5 kilo" → confirm_join, trace stage1 dengan intent pesan_baru', async () => {
    const classifier = fakeClassifier({ intent: "pesan_baru", confidence: 0.99 });
    const { context } = await setup({ classifier });
    const msg = message("mau ikut cabe 5 kilo");
    const result = await understandFreeText(msg, null, await context(msg));
    expect(result.action).toEqual({ type: "confirm_join", batchId: CABAI.id, quantity: 5 });
    expect(result.trace).toMatchObject({ stage: "stage1", intent: "pesan_baru", confidence: 0.99, action: "confirm_join", model: null });
    expect(result.trace.slots).toEqual({ batches: ["Cabai Merah Keriting"], quantity: { value: 5, unit: "kg" }, order: null });
  });

  it("classifier tidak yakin dan tanpa tahap 2 → menu dengan trace fallback", async () => {
    const { context } = await setup({ classifier: fakeClassifier({ intent: "pesan_baru", confidence: 0.4 }, false) });
    const msg = message("mau ikut cabe 5 kilo");
    const result = await understandFreeText(msg, null, await context(msg));
    expect(result.action).toEqual({ type: "menu" });
    expect(result.trace).toMatchObject({ stage: "fallback", intent: "pesan_baru", confidence: 0.4, action: "menu" });
  });

  it("intent yakin tapi slot kurang dan tanpa tahap 2 → menu", async () => {
    const { context } = await setup({ classifier: fakeClassifier({ intent: "ubah_pesanan", confidence: 0.99 }) });
    const msg = message("yg kmrn tambahin 2 lg");
    expect((await understandFreeText(msg, null, await context(msg))).action).toEqual({ type: "menu" });
  });

  it('enter_quantity + "5 kilo aja" → konfirmasi tanpa memanggil classifier', async () => {
    const classifier = fakeClassifier({ intent: "sapaan", confidence: 0.99 });
    const { context } = await setup({ classifier });
    const msg = message("5 kilo aja");
    const result = await understandFreeText(msg, enterQuantity, await context(msg));
    expect(result.action).toEqual({ type: "confirm_join", batchId: CABAI.id, quantity: 5 });
    expect(result.trace.stage).toBe("stage1");
    expect(classifier.classify).not.toHaveBeenCalled();
  });

  it("enter_quantity dengan satuan yang tidak cocok → ask_quantity", async () => {
    const { context } = await setup();
    const msg = message("2 karung");
    expect((await understandFreeText(msg, enterQuantity, await context(msg))).action).toEqual({ type: "ask_quantity", batchId: CABAI.id });
  });

  it("AGENT_ENABLED false → menu tanpa memanggil classifier", async () => {
    const classifier = fakeClassifier({ intent: "pesan_baru", confidence: 0.99 });
    const { context } = await setup({ classifier, agentEnabled: false });
    const msg = message("mau ikut cabe 5 kilo");
    const result = await understandFreeText(msg, null, await context(msg));
    expect(result.action).toEqual({ type: "menu" });
    expect(result.trace.stage).toBe("fallback");
    expect(classifier.classify).not.toHaveBeenCalled();
  });

  it("classifier melempar error → tidak crash, lanjut seperti tanpa classifier", async () => {
    const classifier: IntentClassifier = { version: "x", classify: async () => Promise.reject(new Error("onnx")), accepts: () => true };
    const { context } = await setup({ classifier });
    const msg = message("mau ikut cabe 5 kilo");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await understandFreeText(msg, null, await context(msg))).trace).toMatchObject({ stage: "fallback", intent: null });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("engine dengan understandFreeText", () => {
  it("tahap 1 hanya mengusulkan tombol; data baru tertulis setelah ORDER_CONFIRM", async () => {
    const { deps } = await setup({ classifier: fakeClassifier({ intent: "pesan_baru", confidence: 0.99 }) });
    const engine = createEngine(deps);
    const first = await engine.handle(message("mau ikut cabe 5 kilo"));
    expect(first.trace.stage).toBe("stage1");
    expect(first.replies.at(-1)).toMatchObject({ kind: "buttons" });
    expect(deps.writes).toEqual([]);

    await engine.handle({ ...message("Ya"), kind: "interactive", replyId: BUTTON.ORDER_CONFIRM });
    expect(deps.writes.map((w) => w.kind)).toEqual(["create"]);
    expect(deps.state.orders[0]).toMatchObject({ batchId: CABAI.id, quantity: 5, channel: "simulator" });
  });
});
