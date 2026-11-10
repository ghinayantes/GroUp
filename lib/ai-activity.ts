import pricing from "@/evals/pricing.json";

export const STAGES = ["fixed", "stage1", "stage2", "fallback"] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  fixed: "Perintah tetap",
  stage1: "Classifier lokal",
  stage2: "LLM tahap 2",
  fallback: "Menu cadangan",
};

export type TraceRow = {
  id: string;
  created_at: string;
  channel: string;
  stage: Stage;
  intent: string | null;
  confidence: number | string | null;
  action: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number;
  tools: string[] | null;
};

type Pricing = { inputPerMillion: number; outputPerMillion: number };
type PricingFile = { models: Record<string, Pricing>; comparison: string; checkedAt: string };

export type TraceSummary = {
  total: number;
  byStage: { stage: Stage; count: number; pct: number }[];
  llmCalls: number;
  inputTokens: number;
  outputTokens: number;
  /** Perkiraan biaya bila semua token LLM dibayar dengan harga model pembanding. */
  estimatedCostUsd: number;
  comparisonModel: string;
  pricingCheckedAt: string;
  medianLatencyMs: number | null;
};

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

export function summarizeTraces(rows: TraceRow[], prices: PricingFile = pricing): TraceSummary {
  const total = rows.length;
  const byStage = STAGES.map((stage) => {
    const count = rows.filter((row) => row.stage === stage).length;
    return { stage, count, pct: total ? Math.round((count / total) * 1000) / 10 : 0 };
  });
  const llm = rows.filter((row) => row.model !== null);
  const inputTokens = llm.reduce((sum, row) => sum + (row.input_tokens ?? 0), 0);
  const outputTokens = llm.reduce((sum, row) => sum + (row.output_tokens ?? 0), 0);
  const rate = prices.models[prices.comparison];
  return {
    total,
    byStage,
    llmCalls: llm.length,
    inputTokens,
    outputTokens,
    estimatedCostUsd: (inputTokens * rate.inputPerMillion + outputTokens * rate.outputPerMillion) / 1_000_000,
    comparisonModel: prices.comparison,
    pricingCheckedAt: prices.checkedAt,
    medianLatencyMs: median(rows.map((row) => row.latency_ms)),
  };
}
