import "server-only";
import { executeConfirmation, presentAction, type ActionContext } from "./actions";
import { BATCH_UNAVAILABLE_TEXT, ORDER_CODE_NOT_FOUND_TEXT, ORDER_LOCKED_TEXT, shortCode, text } from "./copy";
import { BUTTON, type AgentSession, type InboundMessage, type Reply } from "./types";

const START = /^(?:mulai|start)(?:\s+([\w-]+))?$/i;
const ORDERS = /^pesanan$/i;
const MANAGE = /^(ubah|batal)\s+([a-z0-9]{6})(?:\s+(\S+))?$/i;
const DISMISS = /^batal$/i;
const QUANTITY = /^\d{1,6}(?:[.,]\d{1,3})?$/;
const BUTTON_IDS = new Set<string>(Object.values(BUTTON));

const parseQuantity = (value: string | undefined) =>
  value !== undefined && QUANTITY.test(value) ? Number(value.replace(",", ".")) : Number.NaN;

const isOpen = (ctx: ActionContext, batchId: string) => ctx.batches.some((batch) => batch.id === batchId && batch.acceptingOrders);

async function removeUnavailable(msg: InboundMessage, ctx: ActionContext): Promise<Reply[]> {
  await ctx.deps.sessions.remove(msg.channel, msg.senderKey);
  return [text(BATCH_UNAVAILABLE_TEXT)];
}

export async function handleFixed(msg: InboundMessage, session: AgentSession | null, ctx: ActionContext): Promise<Reply[] | null> {
  if (msg.replyId && BUTTON_IDS.has(msg.replyId)) return executeConfirmation(msg.replyId, session, ctx);

  if (msg.replyId && session?.stage === "choose_batch") {
    if (isOpen(ctx, msg.replyId)) return presentAction({ type: "ask_quantity", batchId: msg.replyId }, ctx);
    return removeUnavailable(msg, ctx);
  }

  if (msg.kind !== "text") return null;
  const input = msg.text.trim();

  const start = START.exec(input);
  if (start) {
    const batchId = start[1];
    return presentAction(batchId && isOpen(ctx, batchId) ? { type: "ask_quantity", batchId } : { type: "choose_batch", candidateBatchIds: [] }, ctx);
  }

  if (ORDERS.test(input)) return presentAction({ type: "list_orders" }, ctx);

  const manage = MANAGE.exec(input);
  if (manage) {
    const orderCode = manage[2].toUpperCase();
    const order = ctx.orders.find((item) => shortCode(item.id) === orderCode);
    if (!order) return [text(ORDER_CODE_NOT_FOUND_TEXT)];
    if (!order.editable) return [text(ORDER_LOCKED_TEXT)];
    return presentAction(
      manage[1].toLowerCase() === "ubah"
        ? { type: "confirm_change", orderCode, quantity: parseQuantity(manage[3]) }
        : { type: "confirm_cancel", orderCode },
      ctx,
    );
  }

  if (DISMISS.test(input)) return executeConfirmation(BUTTON.DISMISS, session, ctx);

  if (session?.stage === "enter_quantity" && session.batchId && QUANTITY.test(input)) {
    if (!isOpen(ctx, session.batchId)) return removeUnavailable(msg, ctx);
    return presentAction({ type: "confirm_join", batchId: session.batchId, quantity: parseQuantity(input) }, ctx);
  }

  return null;
}
