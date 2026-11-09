import "server-only";
import type { ActionContext } from "./actions";
import { shortCode } from "./copy";
import { extractSlots, parseQuantity, toBatchUnit, type ExtractedSlots } from "./extract";
import type { IntentScore } from "./ports";
import { directAction } from "./router";
import type { AgentSession, InboundMessage, ProposedAction, TraceRecord } from "./types";

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

  return understood({ type: "menu" }, "fallback", score, slots);
}
