import type { Batch } from "@/lib/batch";
import type { ManagedOrder } from "@/lib/orders";
import { extractSlots } from "@/lib/agent/extract";
import type { IntentClassifier } from "@/lib/agent/ports";
import { isGrounded } from "@/lib/agent/stage2/grounding";
import { INTENTS, type TraceRecord } from "@/lib/agent/types";
import { FIXTURE_BATCHES, FIXTURE_NOW } from "@/test/fixtures/batches";
import type { ExtractTestRow, IntentTestRow } from "./datasets";
import { accuracy, confusion, macroF1, percentile } from "./metrics";
import { runScenario, type Scenario, type ScenarioOptions, type ScenarioResult } from "./scenario";

export const OPEN_BATCHES = FIXTURE_BATCHES.filter((batch) => batch.acceptingOrders);

const STAGES: TraceRecord["stage"][] = ["fixed", "stage1", "stage2", "fallback"];

const orderFor = (index: number, batch: Batch): ManagedOrder => ({
  id: `a${String(index).padStart(5, "0")}00-0000-4000-8000-000000000000`,
  customerName: "Pengunjung simulator",
  quantity: 3,
  status: "confirmed",
  paymentStatus: "not_due",
  fulfillmentStatus: "pending",
  finalUnitPrice: null,
  createdAt: FIXTURE_NOW.toISOString(),
  batch,
  editable: true,
});

/** Pesanan tetap untuk suite extract: indeks 0 dan 1 sama-sama cabai (ambigu tanpa kode), indeks 2 bawang merah. */
export const EXTRACT_ORDERS = [orderFor(0, OPEN_BATCHES[0]), orderFor(1, OPEN_BATCHES[0]), orderFor(2, OPEN_BATCHES[1])];

const rate = (hits: boolean[]) => (hits.length ? hits.filter(Boolean).length / hits.length : null);

export function scoreExtract(rows: ExtractTestRow[]) {
  const checks = rows.map((row) => {
    const slots = extractSlots(row.text, { batches: OPEN_BATCHES, orders: EXTRACT_ORDERS });
    const batch = slots.batches.length === 1 ? slots.batches[0].name : slots.batches.length ? "ambigu" : null;
    const order = slots.order ? EXTRACT_ORDERS.indexOf(slots.order) : null;
    const result = {
      batch: batch === row.batch,
      quantity: (slots.quantity?.value ?? null) === row.quantity,
      unit: (slots.quantity?.unit ?? null) === row.unit,
      order: order === row.orderIndex,
    };
    return { row, result, got: { batch, quantity: slots.quantity, order } };
  });
  return {
    rows: rows.length,
    batch: rate(checks.map((c) => c.result.batch)),
    quantity: rate(checks.map((c) => c.result.quantity)),
    unit: rate(checks.map((c) => c.result.unit)),
    order: rate(checks.map((c) => c.result.order)),
    failures: checks.filter((c) => !Object.values(c.result).every(Boolean)).map((c) => ({ text: c.row.text, expected: c.row, got: c.got })),
  };
}

export function summarizeTraces(traces: TraceRecord[]) {
  const byStage = Object.fromEntries(STAGES.map((stage) => [stage, traces.filter((t) => t.stage === stage).length])) as Record<TraceRecord["stage"], number>;
  const freeText = traces.length - byStage.fixed;
  const input = traces.reduce((sum, t) => sum + (t.inputTokens ?? 0), 0);
  const output = traces.reduce((sum, t) => sum + (t.outputTokens ?? 0), 0);
  const latency = Object.fromEntries(
    STAGES.map((stage) => {
      const values = traces.filter((t) => t.stage === stage).map((t) => t.latencyMs);
      return [stage, { p50: percentile(values, 50), p95: percentile(values, 95) }];
    }),
  );
  return {
    messages: traces.length,
    freeText,
    byStage,
    llmCalls: byStage.stage2,
    stage1Coverage: freeText ? byStage.stage1 / freeText : null,
    tokens: { input, output, perMessage: traces.length ? (input + output) / traces.length : 0 },
    latency,
  };
}

export async function runIntentSuite(rows: IntentTestRow[], classifier: IntentClassifier) {
  const scored = [];
  const latencies: number[] = [];
  for (const row of rows) {
    const started = performance.now();
    const score = await classifier.classify(row.text);
    latencies.push(performance.now() - started);
    scored.push({ gold: row.intent, predicted: score.intent, accepted: classifier.accepts(score) });
  }
  const accepted = scored.filter((s) => s.accepted);
  const perIntent = Object.fromEntries(
    INTENTS.map((intent) => {
      const acceptedHere = accepted.filter((s) => s.predicted === intent);
      return [intent, { accepted: acceptedHere.length, precision: rate(acceptedHere.map((s) => s.gold === intent)) }];
    }),
  );
  return {
    rows: rows.length,
    accuracy: accuracy(scored),
    macroF1: macroF1(scored, INTENTS),
    acceptedPrecision: accuracy(accepted),
    stage1AcceptRate: rate(scored.map((s) => s.accepted)),
    perIntent,
    confusion: confusion(scored, INTENTS),
    latencyMs: { p50: percentile(latencies, 50), p95: percentile(latencies, 95) },
  };
}

export async function runScenarioSuite(scenarios: Scenario[], options: Omit<ScenarioOptions, "batches">) {
  const results: ScenarioResult[] = [];
  for (const scenario of scenarios) results.push(await runScenario(scenario, { ...options, batches: FIXTURE_BATCHES }));
  const answers = results.flatMap((r) => r.stage2Results).filter((r) => r.action.type === "answer");
  return {
    scenarios: results.length,
    correct: rate(results.map((r) => r.correct)),
    avgTurns: results.length ? results.reduce((sum, r) => sum + r.turns, 0) / results.length : null,
    confirmationViolations: results.reduce((sum, r) => sum + r.violations, 0),
    errors: results.filter((r) => r.error).map((r) => ({ id: r.id, error: r.error })),
    failed: results.filter((r) => !r.correct).map((r) => r.id),
    grounding: {
      answers: answers.length,
      grounded: rate(answers.map((r) => r.action.type === "answer" && isGrounded(r.action.text, r.toolOutputs))),
    },
    efficiency: summarizeTraces(results.flatMap((r) => r.traces)),
  };
}
