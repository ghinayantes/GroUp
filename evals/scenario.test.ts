import { describe, expect, it } from "vitest";
import type { IntentClassifier } from "@/lib/agent/ports";
import { BUTTON } from "@/lib/agent/types";
import { FIXTURE_BATCHES } from "@/test/fixtures/batches";
import { orderCode, runScenario, type Scenario } from "./scenario";

const sureOrder: IntentClassifier = { version: "fake", classify: async () => ({ intent: "pesan_baru", confidence: 0.99 }), accepts: () => true };
const sureChange: IntentClassifier = { version: "fake", classify: async () => ({ intent: "ubah_pesanan", confidence: 0.99 }), accepts: () => true };

describe("runScenario", () => {
  it("skenario pesan → konfirmasi → pesanan benar tanpa pelanggaran", async () => {
    const scenario: Scenario = {
      id: "join-1",
      turns: [{ text: "mau ikut cabe 5 kilo" }, { replyId: BUTTON.ORDER_CONFIRM }],
      expect: { orders: [{ batch: "Cabai Merah Keriting", quantity: 5, status: "confirmed" }] },
    };
    const result = await runScenario(scenario, { batches: FIXTURE_BATCHES, classifier: sureOrder, stage2: null });
    expect(result).toMatchObject({ id: "join-1", correct: true, turns: 2, violations: 0, writes: 1 });
    expect(result.traces.map((t) => t.stage)).toEqual(["stage1", "fixed"]);
  });

  it("setup orders memakai kode tetap dan list reply bisa merujuk nama batch", async () => {
    const scenario: Scenario = {
      id: "change-1",
      setup: { orders: [{ batch: "Bawang Merah", quantity: 3 }] },
      turns: [{ text: `bawang aku jadiin 8 ya` }, { replyId: BUTTON.CHANGE_CONFIRM }],
      expect: { orders: [{ batch: "Bawang Merah", quantity: 8, status: "confirmed" }] },
    };
    const result = await runScenario(scenario, { batches: FIXTURE_BATCHES, classifier: sureChange, stage2: null });
    expect(orderCode(0)).toBe("A00000");
    expect(result.correct).toBe(true);
  });

  it("hasil akhir berbeda dari harapan → correct false", async () => {
    const scenario: Scenario = {
      id: "join-2",
      turns: [{ text: "mau ikut cabe 5 kilo" }],
      expect: { orders: [{ batch: "Cabai Merah Keriting", quantity: 5, status: "confirmed" }] },
    };
    const result = await runScenario(scenario, { batches: FIXTURE_BATCHES, classifier: sureOrder, stage2: null });
    expect(result.correct).toBe(false);
    expect(result.violations).toBe(0);
  });

  it("menghitung pelanggaran bila data tertulis pada giliran yang bukan tombol konfirmasi", async () => {
    const scenario: Scenario = { id: "bad", turns: [{ text: "apa saja" }], expect: { orders: [], noWrites: true } };
    const result = await runScenario(scenario, {
      batches: FIXTURE_BATCHES,
      classifier: null,
      stage2: null,
      engineFactory: (deps) => ({
        async handle(msg) {
          await deps.orders.createOrder({ batchId: FIXTURE_BATCHES[0].id, channel: msg.channel, senderKey: msg.senderKey, customerName: "x", quantity: 1, messageId: msg.messageId });
          return { replies: [], trace: { stage: "fallback", intent: null, confidence: null, action: "menu", model: null, inputTokens: null, outputTokens: null, latencyMs: 1 } };
        },
      }),
    });
    expect(result.violations).toBe(1);
    expect(result.correct).toBe(false);
  });

  it("list reply batch:<nama> diterjemahkan ke id batch", async () => {
    const scenario: Scenario = {
      id: "list-1",
      turns: [{ text: "MULAI" }, { replyId: "batch:Minyak Goreng" }, { text: "20" }, { replyId: BUTTON.ORDER_CONFIRM }],
      expect: { orders: [{ batch: "Minyak Goreng", quantity: 20, status: "confirmed" }] },
    };
    expect((await runScenario(scenario, { batches: FIXTURE_BATCHES, classifier: null, stage2: null })).correct).toBe(true);
  });
});
