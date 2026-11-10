import "server-only";
import { createHash } from "node:crypto";
import type { Batch } from "@/lib/batch";
import type { ManagedOrder } from "@/lib/orders";
import type { AgentSession, Channel, Frequency, Intent, ProposedAction, SessionStage, TraceRecord } from "./types";

export type NewOrderInput = { batchId: string; channel: Channel; senderKey: string; customerName: string; quantity: number; messageId: string };
export type ManageOrderInput = { orderId: string; channel: Channel; senderKey: string; action: "update" | "cancel"; quantity: number | null };
export type InterestInput = { channel: Channel; senderKey: string; material: string; quantity: number | null; unit: string | null; frequency: Frequency | null };

export type OrdersPort = {
  listOpenBatches(): Promise<Batch[]>;
  listOrders(channel: Channel, senderKey: string): Promise<ManagedOrder[]>;
  createOrder(input: NewOrderInput): Promise<{ id: string }>;
  manageOrder(input: ManageOrderInput): Promise<void>;
  recordInterest(input: InterestInput): Promise<{ id: string }>;
};

export type SessionStore = {
  get(channel: Channel, senderKey: string): Promise<AgentSession | null>;
  save(session: AgentSession): Promise<void>;
  remove(channel: Channel, senderKey: string): Promise<void>;
};

export type HistoryEntry = { role: "user" | "assistant"; content: string; aiGenerated: boolean; at: string };

export type HistoryStore = {
  recent(channel: Channel, senderKey: string, limit: number): Promise<HistoryEntry[]>;
  append(channel: Channel, senderKey: string, entry: Omit<HistoryEntry, "at">): Promise<void>;
};

export type TraceSink = {
  record(channel: Channel, senderHash: string, trace: TraceRecord): Promise<void>;
  countStage2Since(senderHash: string, since: Date): Promise<number>;
};

export type IntentScore = { intent: Intent; confidence: number };

export type IntentClassifier = {
  classify(text: string): Promise<IntentScore>;
  accepts(score: IntentScore): boolean;
  version: string;
};

export type MarketForecast = {
  targetDate: string;
  price: number;
  low: number;
  high: number;
  changePct: number;
  /** Dari ai/harga: BERGEJOLAK bila galat validasi > 10%, TIDAK PASTI bila rentang prediksi mencakup naik dan turun. */
  status: "NAIK" | "TURUN" | "STABIL" | "BERGEJOLAK" | "TIDAK PASTI";
  /** MAPE validasi dalam persen; null bila tidak dihitung. */
  validationMape: number | null;
  model: string;
};

export type MarketPrice = { material: string; region: string; pricePerUnit: number; unit: string; source: string; observedAt: string; forecast?: MarketForecast | null };

export type MarketPricePort = { lookup(material: string, region: string | null): Promise<MarketPrice | null> };

export type ToolContext = { orders: OrdersPort; marketPrice: MarketPricePort; channel: Channel; senderKey: string; batches: Batch[] };

export type Stage2Input = {
  text: string;
  stage1: IntentScore | null;
  sessionStage: SessionStage | null;
  batches: Batch[];
  orders: ManagedOrder[];
  history: HistoryEntry[];
};

export type Stage2Result = {
  action: ProposedAction;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  toolNames: string[];
  toolOutputs: unknown[];
};

export type Stage2Agent = { model: string; propose(input: Stage2Input, tools: ToolContext): Promise<Stage2Result> };

export type EngineDeps = {
  orders: OrdersPort;
  sessions: SessionStore;
  history: HistoryStore;
  traces: TraceSink;
  classifier: IntentClassifier | null;
  stage2: Stage2Agent | null;
  marketPrice: MarketPricePort;
  agentEnabled: boolean;
  siteUrl: string;
  now: () => Date;
};

export const senderHash = (channel: Channel, senderKey: string) =>
  createHash("sha256").update(`${channel}:${senderKey}`).digest("hex");
