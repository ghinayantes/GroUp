import "server-only";
import type { ActionContext } from "./actions";
import { shortCode } from "./copy";
import { extractSlots, parseQuantity, toBatchUnit, type ExtractedSlots } from "./extract";
import { senderHash, type IntentScore, type Stage2Agent } from "./ports";
import { redact } from "./redact";
import { directAction } from "./router";
import { isGrounded } from "./stage2/grounding";
import type { AgentSession, InboundMessage, ProposedAction, TraceRecord } from "./types";

const STAGE2_CALLS_PER_HOUR = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const HISTORY_LIMIT = 6;

export type Understanding = { action: ProposedAction; trace: Omit<TraceRecord, "latencyMs"> };

const describeSlots = (slots: ExtractedSlots) => ({
  batches: slots.batches.map((batch) => batch.name),
  quantity: slots.quantity,
  order: slots.order && shortCode(slots.order.id),
});

function understood(action: ProposedAction, stage: TraceRecord["stage"], score: IntentScore | null, slots?: ExtractedSlots): Understanding {
  return {
    action,
    trace: {
      stage,
      intent: score?.intent ?? null,
      confidence: score?.confidence ?? null,
      action: action.type,
      model: null,
      inputTokens: null,
      outputTokens: null,
      ...(slots && { slots: describeSlots(slots) }),
    },
  };
}

function quantityForSession(text: string, session: AgentSession | null, ctx: ActionContext): ProposedAction | null {
  if (session?.stage !== "enter_quantity" || !session.batchId) return null;
  const batch = ctx.batches.find((b) => b.id === session.batchId);
  const mention = parseQuantity(text);
  if (!batch || !mention) return null;
  const quantity = toBatchUnit(mention, batch.unit);
  return quantity ? { type: "confirm_join", batchId: batch.id, quantity } : { type: "ask_quantity", batchId: batch.id };
}

async function classify(ctx: ActionContext, text: string): Promise<IntentScore | null> {
  if (!ctx.deps.classifier) return null;
  try {
    return await ctx.deps.classifier.classify(text);
  } catch (error) {
    console.error("Stage-1 classifier failed", error);
    return null;
  }
}

export async function understandFreeText(msg: InboundMessage, session: AgentSession | null, ctx: ActionContext): Promise<Understanding> {
  if (!ctx.deps.agentEnabled) return understood({ type: "menu" }, "fallback", null);

  const sessionAction = quantityForSession(msg.text, session, ctx);
  if (sessionAction) return understood(sessionAction, "stage1", null);

  const slots = extractSlots(msg.text, ctx);
  const score = await classify(ctx, msg.text);
  if (score && ctx.deps.classifier?.accepts(score)) {
    const action = directAction(score.intent, slots);
    if (action) return understood(action, "stage1", score, slots);
  }

  if (ctx.deps.stage2) return askStage2(ctx.deps.stage2, msg, session, ctx, score, slots);

  return understood({ type: "menu" }, "fallback", score, slots);
}

async function askStage2(
  stage2: Stage2Agent,
  msg: InboundMessage,
  session: AgentSession | null,
  ctx: ActionContext,
  score: IntentScore | null,
  slots: ExtractedSlots,
): Promise<Understanding> {
  const { deps } = ctx;
  try {
    const since = new Date(deps.now().getTime() - RATE_WINDOW_MS);
    if ((await deps.traces.countStage2Since(senderHash(msg.channel, msg.senderKey), since)) >= STAGE2_CALLS_PER_HOUR) {
      return understood({ type: "menu" }, "fallback", score, slots);
    }
  } catch (error) {
    console.error("Stage-2 rate limit check failed", error instanceof Error ? error.name : "unknown error");
    return understood({ type: "menu" }, "fallback", score, slots);
  }

  try {
    const history = await deps.history.recent(msg.channel, msg.senderKey, HISTORY_LIMIT);
    const result = await stage2.propose(
      {
        text: redact(msg.text),
        stage1: score,
        sessionStage: session?.stage ?? null,
        batches: ctx.batches,
        orders: ctx.orders,
        history: history.map((entry) => ({ ...entry, content: redact(entry.content) })),
      },
      { orders: deps.orders, marketPrice: deps.marketPrice, channel: msg.channel, senderKey: msg.senderKey, batches: ctx.batches },
    );
    const grounded = result.action.type !== "answer" || isGrounded(result.action.text, result.toolOutputs);
    const action: ProposedAction = grounded ? result.action : { type: "menu" };
    const base = understood(action, "stage2", score, slots);
    return {
      action,
      trace: { ...base.trace, model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, tools: result.toolNames },
    };
  } catch (error) {
    console.error("Stage-2 agent failed", error instanceof Error ? error.name : "unknown error");
    const fallback = understood({ type: "menu" }, "fallback", score, slots);
    return { ...fallback, trace: { ...fallback.trace, model: stage2.model } };
  }
}
