import "server-only";
import { presentAction, type ActionContext } from "./actions";
import { ACTION_FAILED_TEXT, AI_PREFIX, aiNoteText, notTextReply, text } from "./copy";
import { handleFixed } from "./fixed-commands";
import { senderHash, type EngineDeps } from "./ports";
import type { EngineResult, InboundMessage, Reply, TraceRecord } from "./types";
import { understandFreeText } from "./understand";

type Outcome = { replies: Reply[]; trace: Omit<TraceRecord, "latencyMs"> };

const NON_TEXT = /[\s\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}‍️⃣]/gu;

const baseTrace = { intent: null, confidence: null, model: null, inputTokens: null, outputTokens: null };
const FIXED_TRACE: Outcome["trace"] = { ...baseTrace, stage: "fixed", action: "fixed" };
const FAILED_TRACE: Outcome["trace"] = { ...baseTrace, stage: "fallback", action: "menu" };

const AI_NOTE_WINDOW_MS = 24 * 60 * 60 * 1000;
const AI_NOTE_HISTORY_LIMIT = 20;

const isNotText = (msg: InboundMessage) => msg.kind === "unsupported" || (msg.kind === "text" && msg.text.replace(NON_TEXT, "") === "");

export function createEngine(deps: EngineDeps) {
  async function respond(msg: InboundMessage): Promise<Outcome> {
    if (isNotText(msg)) return { replies: [notTextReply()], trace: FIXED_TRACE };

    let session = await deps.sessions.get(msg.channel, msg.senderKey);
    if (session && new Date(session.expiresAt).getTime() <= deps.now().getTime()) {
      await deps.sessions.remove(msg.channel, msg.senderKey);
      session = null;
    }

    const [batches, orders] = await Promise.all([deps.orders.listOpenBatches(), deps.orders.listOrders(msg.channel, msg.senderKey)]);
    const ctx: ActionContext = { deps, msg, batches, orders };

    const fixed = await handleFixed(msg, session, ctx);
    if (fixed) return { replies: fixed, trace: FIXED_TRACE };

    const understanding = await understandFreeText(msg, session, ctx);
    return { replies: await labelAiReplies(msg, await presentAction(understanding.action, ctx)), trace: understanding.trace };
  }

  async function labelAiReplies(msg: InboundMessage, replies: Reply[]): Promise<Reply[]> {
    if (!replies.some((reply) => reply.kind === "text" && reply.aiGenerated)) return replies;
    const since = deps.now().getTime() - AI_NOTE_WINDOW_MS;
    const history = await deps.history.recent(msg.channel, msg.senderKey, AI_NOTE_HISTORY_LIMIT);
    let noteDue = !history.some((entry) => entry.aiGenerated && new Date(entry.at).getTime() >= since);
    return replies.map((reply) => {
      if (reply.kind !== "text" || !reply.aiGenerated) return reply;
      const body = `${AI_PREFIX}${reply.body}${noteDue ? `\n\n${aiNoteText(deps.siteUrl)}` : ""}`;
      noteDue = false;
      return { ...reply, body };
    });
  }

  async function record(msg: InboundMessage, result: EngineResult) {
    await deps.history.append(msg.channel, msg.senderKey, { role: "user", content: msg.text, aiGenerated: false });
    for (const reply of result.replies) {
      await deps.history.append(msg.channel, msg.senderKey, { role: "assistant", content: reply.body, aiGenerated: reply.kind === "text" && reply.aiGenerated });
    }
    await deps.traces.record(msg.channel, senderHash(msg.channel, msg.senderKey), result.trace);
  }

  return {
    async handle(msg: InboundMessage): Promise<EngineResult> {
      const started = performance.now();
      let outcome: Outcome;
      try {
        outcome = await respond(msg);
      } catch (error) {
        console.error("Agent engine failed", error);
        outcome = { replies: [text(ACTION_FAILED_TEXT)], trace: FAILED_TRACE };
      }
      const result: EngineResult = { replies: outcome.replies, trace: { ...outcome.trace, latencyMs: performance.now() - started } };
      try {
        await record(msg, result);
      } catch (error) {
        console.error("Agent history/trace could not be recorded", error);
      }
      return result;
    },
  };
}
