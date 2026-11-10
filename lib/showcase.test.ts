import { describe, expect, it } from "vitest";
import type { EvalResult } from "@/evals/summary";
import { FIXTURE_BATCHES } from "@/test/fixtures/batches";
import { evalHighlights, marketGap } from "./showcase";

const result = (suite: string, mode: string, status: string, metrics?: Record<string, unknown>): EvalResult => ({
  suite, mode, status, metrics, date: "2026-11-20", commit: "abc", stage2Model: null, classifierVersion: null,
});
const scenarioMetrics = (llmCalls: number) => ({ correct: 0.93, confirmationViolations: 0, efficiency: { llmCalls, messages: 100, freeText: 80, byStage: { stage1: 55 }, tokens: { input: 1000, output: 200 } } });

describe("evalHighlights", () => {
  it("tanpa hasil eval router → tersembunyi", () => {
    expect(evalHighlights([result("e2e", "router", "skipped")], 300)).toBeNull();
    expect(evalHighlights([], 300)).toBeNull();
  });

  it("data uji kosong → tersembunyi walau ada hasil", () => {
    expect(evalHighlights([result("e2e", "router", "ok", scenarioMetrics(20))], 0)).toBeNull();
  });

  it("dengan hasil router dan llm-only → metrik dari ringkasan yang sama dengan eval:report", () => {
    const highlights = evalHighlights([
      result("e2e", "router", "ok", scenarioMetrics(20)),
      result("e2e", "llm-only", "ok", scenarioMetrics(80)),
      result("intent", "router", "ok", { acceptedPrecision: 0.98 }),
    ], 320);
    expect(highlights).toEqual({ date: "2026-11-20", violations: 0, e2eCorrect: 0.93, llmCallsSaved: 0.75, stage1Precision: 0.98 });
  });
});

describe("marketGap", () => {
  const fair = (savingPct: number) => ({ batchPrice: 1, bestPrice: null, marketPrice: 1, savingPct, unit: "kg", source: "PIHPS", region: "Kota Bandung", observedAt: "2026-11-02", forecast: null });

  it("hanya batch terbuka dengan data pasar, selisih terbesar dulu", () => {
    const [a, b, c] = FIXTURE_BATCHES;
    const gap = marketGap([{ ...a, fairPrice: fair(3) }, { ...b, fairPrice: fair(8) }, { ...c, fairPrice: null }]);
    expect(gap.map((batch) => batch.fairPrice.savingPct)).toEqual([8, 3]);
  });

  it("tanpa batch dengan data pasar → kosong (bagian disembunyikan)", () => {
    expect(marketGap(FIXTURE_BATCHES)).toEqual([]);
  });
});
