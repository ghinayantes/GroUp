import { describe, expect, it } from "vitest";
import { summarizeTraces, type TraceRow } from "./ai-activity";

const row = (stage: TraceRow["stage"], extra: Partial<TraceRow> = {}): TraceRow => ({
  id: crypto.randomUUID(),
  created_at: "2026-11-10T00:00:00Z",
  channel: "whatsapp",
  stage,
  intent: null,
  confidence: null,
  action: "answer",
  model: null,
  input_tokens: null,
  output_tokens: null,
  latency_ms: 100,
  tools: null,
  ...extra,
});

const prices = { models: { pembanding: { inputPerMillion: 1, outputPerMillion: 4 } }, comparison: "pembanding", checkedAt: "2026-11-09" };

describe("summarizeTraces", () => {
  it("menghitung jumlah dan persentase per jalur", () => {
    const summary = summarizeTraces([row("fixed"), row("fixed"), row("stage2", { model: "m" }), row("fallback")], prices);
    expect(summary.total).toBe(4);
    expect(summary.byStage).toEqual([
      { stage: "fixed", count: 2, pct: 50 },
      { stage: "stage1", count: 0, pct: 0 },
      { stage: "stage2", count: 1, pct: 25 },
      { stage: "fallback", count: 1, pct: 25 },
    ]);
  });

  it("panggilan LLM, token, dan biaya hanya dari trace yang memakai model", () => {
    const summary = summarizeTraces([
      row("stage2", { model: "m", input_tokens: 500_000, output_tokens: 100_000 }),
      row("stage2", { model: "m", input_tokens: 500_000, output_tokens: 150_000 }),
      row("fixed", { input_tokens: 999 }),
    ], prices);
    expect(summary).toMatchObject({ llmCalls: 2, inputTokens: 1_000_000, outputTokens: 250_000, estimatedCostUsd: 2, comparisonModel: "pembanding" });
  });

  it("tanpa trace tidak membagi dengan nol", () => {
    const summary = summarizeTraces([], prices);
    expect(summary.byStage.every((stage) => stage.pct === 0)).toBe(true);
    expect(summary.medianLatencyMs).toBeNull();
  });

  it("median latensi", () => {
    expect(summarizeTraces([row("fixed", { latency_ms: 10 }), row("fixed", { latency_ms: 30 }), row("fixed", { latency_ms: 1000 })], prices).medianLatencyMs).toBe(30);
  });
});
