import { shortCode } from "./copy";
import { toBatchUnit, type ExtractedSlots } from "./extract";
import type { Intent, ProposedAction } from "./types";

export function directAction(intent: Intent, slots: ExtractedSlots): ProposedAction | null {
  switch (intent) {
    case "pesan_baru": {
      if (slots.batches.length > 1) return { type: "choose_batch", candidateBatchIds: slots.batches.map((batch) => batch.id) };
      const [batch] = slots.batches;
      if (!batch) return null;
      const quantity = slots.quantity && toBatchUnit(slots.quantity, batch.unit);
      return quantity ? { type: "confirm_join", batchId: batch.id, quantity } : { type: "ask_quantity", batchId: batch.id };
    }
    case "ubah_pesanan": {
      if (!slots.order || !slots.quantity || slots.relative) return null;
      const quantity = toBatchUnit(slots.quantity, slots.order.batch.unit);
      return quantity ? { type: "confirm_change", orderCode: shortCode(slots.order.id), quantity } : null;
    }
    case "batal_pesanan":
      return slots.order ? { type: "confirm_cancel", orderCode: shortCode(slots.order.id) } : null;
    case "cek_pesanan":
      return { type: "list_orders" };
    case "sapaan":
    case "di_luar_topik":
      return { type: "menu" };
    case "tanya_info":
    case "tanya_harga_pasar":
    case "catat_minat":
      return null;
  }
}
