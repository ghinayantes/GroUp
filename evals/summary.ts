import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type EvalResult = {
  suite: string;
  mode: string;
  date: string;
  commit: string;
  status: string;
  reason?: string;
  stage2Model: string | null;
  classifierVersion: string | null;
  metrics?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export const MODES = ["fixed-only", "llm-only", "router"] as const;
export type EvalMode = (typeof MODES)[number];

export const RESULTS_DIR = "evals/results";

export function readEvalResults(dir = path.join(process.cwd(), RESULTS_DIR)): EvalResult[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(path.join(dir, file), "utf8")) as EvalResult);
}

export type ScenarioTotals = { violations: number; llmCalls: number; messages: number; freeText: number; stage1: number; input: number; output: number };

/** Ringkasan hasil eval untuk `npm run eval:report`. */
export function summarizeEval(results: EvalResult[]) {
  const latest = (suite: string, mode: string) => results.filter((r) => r.suite === suite && r.mode === mode && r.status === "ok").at(-1);
  const scenarioTotals = (mode: string): ScenarioTotals | null => {
    const runs = ["e2e", "safety"].map((suite) => latest(suite, mode)).filter(Boolean) as EvalResult[];
    if (!runs.length) return null;
    const sum = (pick: (m: Record<string, any>) => number) => runs.reduce((total, r) => total + pick(r.metrics!), 0); // eslint-disable-line @typescript-eslint/no-explicit-any
    return {
      violations: sum((m) => m.confirmationViolations),
      llmCalls: sum((m) => m.efficiency.llmCalls),
      messages: sum((m) => m.efficiency.messages),
      freeText: sum((m) => m.efficiency.freeText),
      stage1: sum((m) => m.efficiency.byStage.stage1),
      input: sum((m) => m.efficiency.tokens.input),
      output: sum((m) => m.efficiency.tokens.output),
    };
  };
  const totals = Object.fromEntries(MODES.map((mode) => [mode, scenarioTotals(mode)])) as Record<EvalMode, ScenarioTotals | null>;
  const llmCallsSaved = totals["llm-only"]?.llmCalls ? 1 - (totals.router?.llmCalls ?? 0) / totals["llm-only"].llmCalls : null;
  return { latest, totals, llmCallsSaved };
}
