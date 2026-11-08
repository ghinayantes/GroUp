import "server-only";
import type { ActionContext } from "./actions";
import type { AgentSession, InboundMessage, ProposedAction, TraceRecord } from "./types";

export type Understanding = { action: ProposedAction; trace: Omit<TraceRecord, "latencyMs"> };

/** Versi awal tanpa router: Tugas 13 dan 15 mengganti isi fungsi ini, bukan engine. */
export const understandFreeText: (msg: InboundMessage, session: AgentSession | null, ctx: ActionContext) => Promise<Understanding> = async () => ({
  action: { type: "menu" },
  trace: { stage: "fallback", intent: null, confidence: null, action: "menu", model: null, inputTokens: null, outputTokens: null },
});
