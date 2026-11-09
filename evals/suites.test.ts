import { describe, expect, it } from "vitest";
import type { TraceRecord } from "@/lib/agent/types";
import { scoreExtract, summarizeTraces } from "./suites";

const trace = (stage: TraceRecord["stage"], latencyMs: number, tokens: [number, number] | null = null): TraceRecord => ({
  stage,
  intent: null,
  confidence: null,
  action: "menu",
  model: tokens ? "m" : null,
  inputTokens: tokens?.[0] ?? null,
  outputTokens: tokens?.[1] ?? null,
  latencyMs,
});

describe("scoreExtract", () => {
  it("menilai batch, jumlah, satuan, dan pesanan per slot", () => {
    const result = scoreExtract([
      { text: "cabe 5 kilo", batch: "Cabai Merah Keriting", quantity: 5, unit: "kg", orderIndex: null },
      { text: "bawang 2,5 kg", batch: "Bawang Merah", quantity: 2.5, unit: "kg", orderIndex: 1 },
      { text: "minyak 3", batch: "Tepung Terigu Protein Tinggi", quantity: 3, unit: null, orderIndex: null },
    ]);
    expect(result.rows).toBe(3);
    expect(result.batch).toBeCloseTo(2 / 3);
    expect(result.quantity).toBe(1);
    expect(result.unit).toBe(1);
    expect(result.order).toBeCloseTo(2 / 3);
    expect(result.failures.map((f) => f.text)).toEqual(["bawang 2,5 kg", "minyak 3"]);
  });

  it("dataset kosong → metrik null", () => {
    expect(scoreExtract([])).toMatchObject({ rows: 0, batch: null, quantity: null });
  });
});

describe("summarizeTraces", () => {
  it("menghitung tahap, panggilan LLM, token, dan latensi per tahap", () => {
    const summary = summarizeTraces([trace("fixed", 2), trace("stage1", 40), trace("stage1", 60), trace("stage2", 900, [100, 20]), trace("fallback", 5)]);
    expect(summary.messages).toBe(5);
    expect(summary.freeText).toBe(4);
    expect(summary.byStage).toEqual({ fixed: 1, stage1: 2, stage2: 1, fallback: 1 });
    expect(summary.llmCalls).toBe(1);
    expect(summary.stage1Coverage).toBeCloseTo(2 / 4);
    expect(summary.tokens).toEqual({ input: 100, output: 20, perMessage: 24 });
    expect(summary.latency.stage1).toEqual({ p50: 40, p95: 60 });
  });
});
