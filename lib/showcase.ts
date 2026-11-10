import type { Batch } from "@/lib/batch";
import { summarizeEval, type EvalResult } from "@/evals/summary";

export type EvalHighlights = {
  date: string;
  violations: number | null;
  e2eCorrect: number | null;
  llmCallsSaved: number | null;
  stage1Precision: number | null;
};

/** Strip metrik hanya tampil bila eval router sudah dijalankan dan data uji tulisan manusia tidak kosong. */
export function evalHighlights(results: EvalResult[], testRows: number): EvalHighlights | null {
  if (testRows === 0) return null;
  const { latest, totals, llmCallsSaved } = summarizeEval(results);
  const e2e = latest("e2e", "router");
  if (!e2e) return null;
  return {
    date: e2e.date,
    violations: totals.router?.violations ?? null,
    e2eCorrect: e2e.metrics?.correct ?? null,
    llmCallsSaved,
    stage1Precision: latest("intent", "router")?.metrics?.acceptedPrecision ?? null,
  };
}

/** Batch terbuka yang punya pembanding harga pasar, selisih terbesar dulu. */
export function marketGap(batches: Batch[], limit = 3) {
  return batches
    .filter((batch): batch is Batch & { fairPrice: NonNullable<Batch["fairPrice"]> } => batch.acceptingOrders && batch.fairPrice !== null)
    .sort((a, b) => b.fairPrice.savingPct - a.fairPrice.savingPct)
    .slice(0, limit);
}
