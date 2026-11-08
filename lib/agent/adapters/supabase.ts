import "server-only";
import { isValidQuantity } from "@/lib/batch";
import {
  BATCH_CLOSED_MESSAGE,
  INVALID_QUANTITY_MESSAGE,
  ORDER_NOT_FOUND_MESSAGE,
  createOrder,
  isUuid,
  listOpenBatches,
  listOrdersForSender,
  manageOrder,
  recordDemandInterest,
} from "@/lib/orders";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { EngineDeps, HistoryEntry } from "../ports";
import type { AgentSession, ProposedAction } from "../types";

export type SupabaseDeps = Omit<EngineDeps, "classifier" | "stage2" | "agentEnabled" | "siteUrl" | "now">;

const MAX_MESSAGE_LENGTH = 2000;

type SessionRow = {
  phone: string;
  channel: AgentSession["channel"];
  stage: AgentSession["stage"];
  patungan_id: string | null;
  quantity: number | string | null;
  customer_name: string | null;
  pending_action: ProposedAction | null;
  expires_at: string;
};

type MessageRow = { role: HistoryEntry["role"]; content: string; ai_generated: boolean; created_at: string };

const sessionColumns = "phone, channel, stage, patungan_id, quantity, customer_name, pending_action, expires_at";

export function createSupabaseDeps(): SupabaseDeps {
  return {
    orders: {
      listOpenBatches,
      listOrders: listOrdersForSender,
      async createOrder(input) {
        if (!isUuid(input.batchId)) throw new Error(BATCH_CLOSED_MESSAGE);
        if (!isValidQuantity(input.quantity)) throw new Error(INVALID_QUANTITY_MESSAGE);
        const { id } = await createOrder({
          groupId: input.batchId,
          customerName: input.customerName,
          phone: input.senderKey,
          quantity: input.quantity,
          channel: input.channel,
          providerMessageId: input.messageId,
        });
        return { id };
      },
      async manageOrder(input) {
        if (!isUuid(input.orderId)) throw new Error(ORDER_NOT_FOUND_MESSAGE);
        await manageOrder(input.orderId, { channel: input.channel, key: input.senderKey }, null, input.action, input.action === "update" ? input.quantity : null);
      },
      recordInterest: recordDemandInterest,
    },
    sessions: {
      async get(channel, senderKey) {
        const { data, error } = await createSupabaseAdminClient()
          .from("whatsapp_sessions")
          .select(sessionColumns)
          .eq("channel", channel)
          .eq("phone", senderKey)
          .maybeSingle();
        if (error) throw new Error("Sesi percakapan tidak dapat dimuat.");
        if (!data) return null;
        const row = data as SessionRow;
        return {
          channel: row.channel,
          senderKey: row.phone,
          stage: row.stage,
          batchId: row.patungan_id,
          quantity: row.quantity === null ? null : Number(row.quantity),
          customerName: row.customer_name,
          pendingAction: row.pending_action,
          expiresAt: row.expires_at,
        };
      },
      async save(session) {
        const { error } = await createSupabaseAdminClient()
          .from("whatsapp_sessions")
          .upsert(
            {
              phone: session.senderKey,
              channel: session.channel,
              stage: session.stage,
              patungan_id: session.batchId,
              quantity: session.quantity,
              customer_name: session.customerName,
              pending_action: session.pendingAction,
              expires_at: session.expiresAt,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "phone" },
          );
        if (error) throw new Error("Sesi percakapan tidak dapat disimpan.");
      },
      async remove(channel, senderKey) {
        const { error } = await createSupabaseAdminClient().from("whatsapp_sessions").delete().eq("channel", channel).eq("phone", senderKey);
        if (error) throw new Error("Sesi percakapan tidak dapat dihapus.");
      },
    },
    history: {
      async recent(channel, senderKey, limit) {
        const { data, error } = await createSupabaseAdminClient()
          .from("agent_messages")
          .select("role, content, ai_generated, created_at")
          .eq("channel", channel)
          .eq("sender_key", senderKey)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw new Error("Riwayat percakapan tidak dapat dimuat.");
        return (data as MessageRow[])
          .map((row) => ({ role: row.role, content: row.content, aiGenerated: row.ai_generated, at: row.created_at }))
          .reverse();
      },
      async append(channel, senderKey, entry) {
        const { error } = await createSupabaseAdminClient()
          .from("agent_messages")
          .insert({
            channel,
            sender_key: senderKey,
            role: entry.role,
            content: entry.content.slice(0, MAX_MESSAGE_LENGTH),
            ai_generated: entry.aiGenerated,
          });
        if (error) throw new Error("Riwayat percakapan tidak dapat disimpan.");
      },
    },
    traces: {
      async record(channel, senderHash, trace) {
        const { error } = await createSupabaseAdminClient()
          .from("agent_traces")
          .insert({
            channel,
            sender_hash: senderHash,
            stage: trace.stage,
            intent: trace.intent,
            confidence: trace.confidence,
            action: trace.action,
            model: trace.model,
            input_tokens: trace.inputTokens,
            output_tokens: trace.outputTokens,
            latency_ms: Math.round(trace.latencyMs),
          });
        if (error) throw new Error("Trace agen tidak dapat disimpan.");
      },
      async countStage2Since(senderHash, since) {
        const { count, error } = await createSupabaseAdminClient()
          .from("agent_traces")
          .select("id", { count: "exact", head: true })
          .eq("sender_hash", senderHash)
          .eq("stage", "stage2")
          .gte("created_at", since.toISOString());
        if (error) throw new Error("Trace agen tidak dapat dimuat.");
        return count ?? 0;
      },
    },
    marketPrice: { lookup: async () => null },
  };
}
