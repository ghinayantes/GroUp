import { isValidQuantity, type Batch } from "@/lib/batch";
import type { ManagedOrder } from "@/lib/orders";
import type { EngineDeps, HistoryEntry, InterestInput, NewOrderInput } from "../ports";
import type { AgentSession, Channel, TraceRecord } from "../types";

export const SIMULATOR_ORDER_LIMIT = 50;

const BATCH_CLOSED = "Batch ini sudah ditutup. Pesanan tidak dapat dibuat atau diubah.";
const ORDER_NOT_FOUND = "Pesanan tidak ditemukan. Periksa kode pengelolaan.";
const INVALID_QUANTITY = "Jumlah harus lebih dari nol dan maksimal 100.000.";
const SIMULATOR_FULL = "Batas pesanan simulator untuk batch ini sudah penuh.";

export type MemoryOrder = {
  id: string;
  channel: Channel;
  senderKey: string;
  batchId: string;
  customerName: string;
  quantity: number;
  status: "confirmed" | "cancelled";
  messageId: string | null;
  createdAt: string;
};

export type MemoryInterest = InterestInput & { id: string; createdAt: string };

export type MemoryWrite = { kind: "create" | "update" | "cancel" | "interest"; at: number };

export type MemoryInit = { batches: Batch[]; orders?: MemoryOrder[]; now?: Date };

export type MemoryDeps = EngineDeps & {
  writes: MemoryWrite[];
  state: {
    orders: MemoryOrder[];
    interests: MemoryInterest[];
    sessions: Map<string, AgentSession>;
    history: Map<string, HistoryEntry[]>;
    traces: { channel: Channel; senderHash: string; trace: TraceRecord; at: Date }[];
  };
};

const key = (channel: Channel, senderKey: string) => `${channel}:${senderKey}`;

export function createMemoryDeps(init: MemoryInit): MemoryDeps {
  const state: MemoryDeps["state"] = {
    orders: [...(init.orders ?? [])],
    interests: [],
    sessions: new Map(),
    history: new Map(),
    traces: [],
  };
  const writes: MemoryWrite[] = [];

  const confirmedQuantity = (batchId: string) =>
    state.orders.filter((o) => o.batchId === batchId && o.status === "confirmed").reduce((sum, o) => sum + o.quantity, 0);

  const hydrate = (batch: Batch): Batch => ({ ...batch, current: confirmedQuantity(batch.id) });

  const toManaged = (order: MemoryOrder): ManagedOrder => {
    const batch = hydrate(init.batches.find((b) => b.id === order.batchId)!);
    return {
      id: order.id,
      customerName: order.customerName,
      quantity: order.quantity,
      status: order.status,
      paymentStatus: "not_due",
      fulfillmentStatus: "pending",
      finalUnitPrice: null,
      createdAt: order.createdAt,
      batch,
      editable: order.status === "confirmed" && batch.acceptingOrders,
    };
  };

  const record = (kind: MemoryWrite["kind"]) => writes.push({ kind, at: deps.now().getTime() });

  const deps: MemoryDeps = {
    orders: {
      async listOpenBatches() {
        return init.batches.filter((b) => b.status === "open" && b.acceptingOrders).map(hydrate);
      },
      async listOrders(channel, senderKey) {
        return state.orders
          .filter((o) => o.channel === channel && o.senderKey === senderKey && o.status === "confirmed")
          .map(toManaged);
      },
      async createOrder(input: NewOrderInput) {
        const existing = state.orders.find((o) => o.messageId === input.messageId);
        if (existing) return { id: existing.id };
        const batch = init.batches.find((b) => b.id === input.batchId);
        if (!batch || !batch.acceptingOrders) throw new Error(BATCH_CLOSED);
        if (!isValidQuantity(input.quantity)) throw new Error(INVALID_QUANTITY);
        if (input.channel === "simulator") {
          const active = state.orders.filter((o) => o.batchId === batch.id && o.channel === "simulator" && o.status === "confirmed").length;
          if (active >= SIMULATOR_ORDER_LIMIT) throw new Error(SIMULATOR_FULL);
        }
        const order: MemoryOrder = {
          id: crypto.randomUUID(),
          channel: input.channel,
          senderKey: input.senderKey,
          batchId: batch.id,
          customerName: input.customerName,
          quantity: input.quantity,
          status: "confirmed",
          messageId: input.messageId,
          createdAt: deps.now().toISOString(),
        };
        state.orders.push(order);
        record("create");
        return { id: order.id };
      },
      async manageOrder(input) {
        const order = state.orders.find((o) => o.id === input.orderId && o.channel === input.channel && o.senderKey === input.senderKey && o.status === "confirmed");
        if (!order) throw new Error(ORDER_NOT_FOUND);
        const batch = init.batches.find((b) => b.id === order.batchId);
        if (!batch || !batch.acceptingOrders) throw new Error(BATCH_CLOSED);
        if (input.action === "update") {
          if (input.quantity === null || !isValidQuantity(input.quantity)) throw new Error(INVALID_QUANTITY);
          order.quantity = input.quantity;
          record("update");
        } else {
          order.status = "cancelled";
          record("cancel");
        }
      },
      async recordInterest(input) {
        const material = input.material.trim();
        if (material.length < 2 || material.length > 120) throw new Error("Nama bahan harus 2 sampai 120 karakter.");
        if (input.quantity !== null && !isValidQuantity(input.quantity)) throw new Error(INVALID_QUANTITY);
        const interest: MemoryInterest = { ...input, material, id: crypto.randomUUID(), createdAt: deps.now().toISOString() };
        state.interests.push(interest);
        record("interest");
        return { id: interest.id };
      },
    },
    sessions: {
      async get(channel, senderKey) {
        return state.sessions.get(key(channel, senderKey)) ?? null;
      },
      async save(session) {
        state.sessions.set(key(session.channel, session.senderKey), session);
      },
      async remove(channel, senderKey) {
        state.sessions.delete(key(channel, senderKey));
      },
    },
    history: {
      async recent(channel, senderKey, limit) {
        return (state.history.get(key(channel, senderKey)) ?? []).slice(-limit);
      },
      async append(channel, senderKey, entry) {
        const entries = state.history.get(key(channel, senderKey)) ?? [];
        entries.push({ ...entry, at: deps.now().toISOString() });
        state.history.set(key(channel, senderKey), entries);
      },
    },
    traces: {
      async record(channel, senderHash, trace) {
        state.traces.push({ channel, senderHash, trace, at: deps.now() });
      },
      async countStage2Since(senderHash, since) {
        return state.traces.filter((t) => t.senderHash === senderHash && t.trace.model !== null && t.at.getTime() >= since.getTime()).length;
      },
    },
    classifier: null,
    stage2: null,
    marketPrice: { lookup: async () => null },
    agentEnabled: true,
    siteUrl: "http://localhost:3000",
    now: () => init.now ?? new Date(),
    writes,
    state,
  };
  return deps;
}
