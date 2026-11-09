import type { Batch } from "@/lib/batch";
import { createMemoryDeps, type MemoryDeps, type MemoryOrder } from "@/lib/agent/adapters/memory";
import { createMarketPricePort } from "@/lib/agent/adapters/market-price";
import { shortCode } from "@/lib/agent/copy";
import { createEngine } from "@/lib/agent/engine";
import type { IntentClassifier, MarketPricePort, Stage2Agent, Stage2Result } from "@/lib/agent/ports";
import { BUTTON, type EngineResult, type Frequency, type InboundMessage, type TraceRecord } from "@/lib/agent/types";
import { FIXTURE_NOW } from "@/test/fixtures/batches";

export type Turn = { text: string } | { replyId: string };

export type Scenario = {
  id: string;
  setup?: { orders: { batch: string; quantity: number }[] };
  turns: Turn[];
  expect: {
    orders: { batch: string; quantity: number; status: "confirmed" | "cancelled" }[];
    interests?: { material: string; frequency: Frequency | null }[];
    noWrites?: boolean;
  };
};

export type ScenarioResult = {
  id: string;
  correct: boolean;
  turns: number;
  violations: number;
  writes: number;
  traces: TraceRecord[];
  stage2Results: Stage2Result[];
  error?: string;
};

type Engine = { handle(msg: InboundMessage): Promise<EngineResult> };

export type ScenarioOptions = {
  batches: Batch[];
  classifier: IntentClassifier | null;
  stage2: Stage2Agent | null;
  marketPrice?: MarketPricePort;
  engineFactory?: (deps: MemoryDeps) => Engine;
};

const CONFIRM_BUTTONS = new Set<string>([BUTTON.ORDER_CONFIRM, BUTTON.CHANGE_CONFIRM, BUTTON.CANCEL_CONFIRM, BUTTON.INTEREST_CONFIRM]);

const orderId = (index: number) => `a${String(index).padStart(5, "0")}00-0000-4000-8000-000000000000`;

export const orderCode = (index: number) => shortCode(orderId(index));

const canonical = (rows: unknown[]) => JSON.stringify(rows.map((row) => JSON.stringify(row)).sort());

function batchByName(batches: Batch[], name: string) {
  const batch = batches.find((b) => b.name.toLowerCase() === name.toLowerCase());
  if (!batch) throw new Error(`Batch "${name}" tidak ada di fixture`);
  return batch;
}

export async function runScenario(scenario: Scenario, options: ScenarioOptions): Promise<ScenarioResult> {
  const senderKey = `sim-eval-${scenario.id}`;
  const setup: MemoryOrder[] = (scenario.setup?.orders ?? []).map((order, i) => ({
    id: orderId(i),
    channel: "simulator",
    senderKey,
    batchId: batchByName(options.batches, order.batch).id,
    customerName: "Pengunjung simulator",
    quantity: order.quantity,
    status: "confirmed",
    messageId: null,
    createdAt: FIXTURE_NOW.toISOString(),
  }));

  const stage2Results: Stage2Result[] = [];
  const stage2: Stage2Agent | null = options.stage2 && {
    model: options.stage2.model,
    async propose(input, tools) {
      const result = await options.stage2!.propose(input, tools);
      stage2Results.push(result);
      return result;
    },
  };

  const deps = Object.assign(createMemoryDeps({ batches: options.batches, orders: setup, now: FIXTURE_NOW }), {
    classifier: options.classifier,
    stage2,
    marketPrice: options.marketPrice ?? createMarketPricePort(),
  });
  const engine = options.engineFactory?.(deps) ?? createEngine(deps);

  const traces: TraceRecord[] = [];
  let violations = 0;
  try {
    for (const [i, turn] of scenario.turns.entries()) {
      const before = deps.writes.length;
      const replyId = "replyId" in turn ? (turn.replyId.startsWith("batch:") ? batchByName(options.batches, turn.replyId.slice(6)).id : turn.replyId) : undefined;
      const msg: InboundMessage = {
        channel: "simulator",
        senderKey,
        messageId: `${scenario.id}-${i}`,
        text: "text" in turn ? turn.text : replyId!,
        kind: replyId ? "interactive" : "text",
        ...(replyId && { replyId }),
        profileName: "Pengunjung simulator",
      };
      traces.push((await engine.handle(msg)).trace);
      if (deps.writes.length > before && !(replyId && CONFIRM_BUTTONS.has(replyId))) violations += 1;
    }
  } catch (error) {
    return { id: scenario.id, correct: false, turns: traces.length, violations, writes: deps.writes.length, traces, stage2Results, error: String(error) };
  }

  const byId = new Map(options.batches.map((b) => [b.id, b.name]));
  const orders = deps.state.orders.map((o) => ({ batch: byId.get(o.batchId), quantity: o.quantity, status: o.status }));
  const interests = deps.state.interests.map((i) => ({ material: i.material.toLowerCase(), frequency: i.frequency }));
  const expected = scenario.expect;
  const correct =
    violations === 0 &&
    canonical(orders) === canonical(expected.orders) &&
    (!expected.interests || canonical(interests) === canonical(expected.interests.map((i) => ({ ...i, material: i.material.toLowerCase() })))) &&
    (!expected.noWrites || deps.writes.length === 0);

  return { id: scenario.id, correct, turns: scenario.turns.length, violations, writes: deps.writes.length, traces, stage2Results };
}
