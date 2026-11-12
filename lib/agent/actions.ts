import "server-only";
import { isValidQuantity, type Batch } from "@/lib/batch";
import type { ManagedOrder } from "@/lib/orders";
import {
  ACTION_FAILED_TEXT,
  DISMISSED_TEXT,
  EXPIRED_TEXT,
  NOTHING_TO_DISMISS_TEXT,
  ORDER_CODE_NOT_FOUND_TEXT,
  batchListReply,
  changeFormatText,
  confirmCancelReply,
  confirmChangeReply,
  confirmInterestReply,
  confirmJoinReply,
  interestRecordedText,
  menuText,
  orderCancelledText,
  orderChangedText,
  orderCreatedText,
  ordersReply,
  quantityPrompt,
  shortCode,
  text,
} from "./copy";
import type { EngineDeps } from "./ports";
import { BUTTON, type AgentSession, type InboundMessage, type ProposedAction, type Reply, type SessionStage } from "./types";

export type ActionContext = { deps: EngineDeps; msg: InboundMessage; batches: Batch[]; orders: ManagedOrder[] };

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;


const BUTTON_STAGE: Record<string, SessionStage> = {
  [BUTTON.ORDER_CONFIRM]: "confirm_order",
  [BUTTON.CHANGE_CONFIRM]: "confirm_change",
  [BUTTON.CANCEL_CONFIRM]: "confirm_cancel",
  [BUTTON.INTEREST_CONFIRM]: "confirm_interest",
};

const openBatch = (ctx: ActionContext, batchId: string) =>
  ctx.batches.find((batch) => batch.id === batchId && batch.acceptingOrders) ?? null;

const editableOrder = (ctx: ActionContext, code: string) =>
  ctx.orders.find((order) => order.editable && shortCode(order.id) === code.trim().toUpperCase()) ?? null;

const menu = () => [text(menuText())];

async function saveSession(ctx: ActionContext, values: Pick<AgentSession, "stage"> & Partial<Pick<AgentSession, "batchId" | "quantity" | "pendingAction">>) {
  await ctx.deps.sessions.save({
    channel: ctx.msg.channel,
    senderKey: ctx.msg.senderKey,
    stage: values.stage,
    batchId: values.batchId ?? null,
    quantity: values.quantity ?? null,
    customerName: ctx.msg.profileName ?? null,
    pendingAction: values.pendingAction ?? null,
    expiresAt: new Date(ctx.deps.now().getTime() + SESSION_TTL_MS).toISOString(),
  });
}

export async function presentAction(action: ProposedAction, ctx: ActionContext): Promise<Reply[]> {
  switch (action.type) {
    case "confirm_join": {
      const batch = openBatch(ctx, action.batchId);
      if (!batch) return menu();
      if (!isValidQuantity(action.quantity)) return presentAction({ type: "ask_quantity", batchId: batch.id }, ctx);
      await saveSession(ctx, { stage: "confirm_order", batchId: batch.id, quantity: action.quantity });
      return [confirmJoinReply(batch, action.quantity)];
    }
    case "ask_quantity": {
      const batch = openBatch(ctx, action.batchId);
      if (!batch) return menu();
      await saveSession(ctx, { stage: "enter_quantity", batchId: batch.id });
      return [text(quantityPrompt(batch))];
    }
    case "choose_batch": {
      const open = ctx.batches.filter((batch) => batch.acceptingOrders);
      const candidates = open.filter((batch) => action.candidateBatchIds.includes(batch.id));
      const shown = candidates.length ? candidates : open;
      if (shown.length) await saveSession(ctx, { stage: "choose_batch" });
      return [batchListReply(shown)];
    }
    case "confirm_change": {
      const order = editableOrder(ctx, action.orderCode);
      if (!order) return menu();
      if (!isValidQuantity(action.quantity)) return [text(changeFormatText(order))];
      const pendingAction = { ...action, orderCode: shortCode(order.id) };
      await saveSession(ctx, { stage: "confirm_change", pendingAction });
      return [confirmChangeReply(order, action.quantity)];
    }
    case "confirm_cancel": {
      const order = editableOrder(ctx, action.orderCode);
      if (!order) return menu();
      await saveSession(ctx, { stage: "confirm_cancel", pendingAction: { ...action, orderCode: shortCode(order.id) } });
      return [confirmCancelReply(order)];
    }
    case "confirm_interest": {
      const material = action.material.trim();
      if (material.length < 2 || material.length > 120) return menu();
      const quantity = action.quantity !== null && isValidQuantity(action.quantity) ? action.quantity : null;
      const pendingAction = { ...action, material, quantity, unit: quantity === null ? null : action.unit };
      await saveSession(ctx, { stage: "confirm_interest", pendingAction });
      return [confirmInterestReply(pendingAction)];
    }
    case "list_orders":
      return [ordersReply(ctx.orders)];
    case "answer":
      return [text(action.text, true)];
    case "menu":
      return menu();
  }
}

const isLive = (session: AgentSession | null, stage: SessionStage | undefined, now: Date): session is AgentSession =>
  session !== null && stage !== undefined && session.stage === stage && new Date(session.expiresAt).getTime() > now.getTime();

async function execute(session: AgentSession, ctx: ActionContext): Promise<Reply[]> {
  const { deps, msg } = ctx;
  const pending = session.pendingAction;
  switch (session.stage) {
    case "confirm_order": {
      if (!session.batchId || session.quantity === null) return [text(EXPIRED_TEXT)];
      const created = await deps.orders.createOrder({
        batchId: session.batchId,
        channel: msg.channel,
        senderKey: msg.senderKey,
        customerName: session.customerName ?? msg.profileName ?? msg.senderKey,
        quantity: session.quantity,
        messageId: msg.messageId,
      });
      return [text(orderCreatedText(created.id))];
    }
    case "confirm_change":
    case "confirm_cancel": {
      if (pending?.type !== "confirm_change" && pending?.type !== "confirm_cancel") return [text(EXPIRED_TEXT)];
      const order = ctx.orders.find((item) => shortCode(item.id) === pending.orderCode);
      if (!order) return [text(ORDER_CODE_NOT_FOUND_TEXT)];
      const quantity = pending.type === "confirm_change" ? pending.quantity : null;
      await deps.orders.manageOrder({
        orderId: order.id,
        channel: msg.channel,
        senderKey: msg.senderKey,
        action: quantity === null ? "cancel" : "update",
        quantity,
      });
      return [text(quantity === null ? orderCancelledText(order) : orderChangedText(order, quantity))];
    }
    case "confirm_interest": {
      if (pending?.type !== "confirm_interest") return [text(EXPIRED_TEXT)];
      await deps.orders.recordInterest({
        channel: msg.channel,
        senderKey: msg.senderKey,
        material: pending.material,
        quantity: pending.quantity,
        unit: pending.unit,
        frequency: pending.frequency,
      });
      return [text(interestRecordedText(pending.material))];
    }
    default:
      return [text(EXPIRED_TEXT)];
  }
}

export async function executeConfirmation(buttonId: string, session: AgentSession | null, ctx: ActionContext): Promise<Reply[]> {
  const { deps, msg } = ctx;
  if (buttonId === BUTTON.DISMISS) {
    if (!session) return [text(NOTHING_TO_DISMISS_TEXT)];
    await deps.sessions.remove(msg.channel, msg.senderKey);
    return [text(DISMISSED_TEXT)];
  }
  if (!isLive(session, BUTTON_STAGE[buttonId], deps.now())) return [text(EXPIRED_TEXT)];
  try {
    return await execute(session, ctx);
  } catch (error) {
    return [text(error instanceof Error ? error.message : ACTION_FAILED_TEXT)];
  } finally {
    await deps.sessions.remove(msg.channel, msg.senderKey).catch((error: unknown) => console.error("Agent session could not be removed", error));
  }
}
