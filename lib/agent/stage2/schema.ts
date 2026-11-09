import { z } from "zod";
import { MAX_ORDER_QUANTITY } from "@/lib/batch";
import type { ProposedAction } from "../types";

const quantity = z.number().positive().max(MAX_ORDER_QUANTITY);

export const ProposedActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("confirm_join"), batchId: z.string().min(1), quantity }),
  z.object({ type: z.literal("ask_quantity"), batchId: z.string().min(1) }),
  z.object({ type: z.literal("choose_batch"), candidateBatchIds: z.array(z.string().min(1)).min(1).max(5) }),
  z.object({ type: z.literal("confirm_change"), orderCode: z.string().min(1), quantity }),
  z.object({ type: z.literal("confirm_cancel"), orderCode: z.string().min(1) }),
  z.object({ type: z.literal("list_orders") }),
  z.object({
    type: z.literal("confirm_interest"),
    material: z.string().trim().min(2).max(120),
    quantity: quantity.nullable(),
    unit: z.string().max(20).nullable(),
    frequency: z.enum(["sekali", "mingguan", "bulanan"]).nullable(),
  }),
  z.object({ type: z.literal("answer"), text: z.string().min(1).max(700) }),
  z.object({ type: z.literal("menu") }),
]) satisfies z.ZodType<ProposedAction>;

export const Stage2OutputSchema = z.object({ action: ProposedActionSchema });
