import { describe, expect, it } from "vitest";
import type { Batch } from "@/lib/batch";
import type { ManagedOrder } from "@/lib/orders";
import { FIXTURE_BATCHES } from "@/test/fixtures/batches";
import { extractSlots } from "./extract";
import { directAction } from "./router";
import type { Intent } from "./types";

const OPEN = FIXTURE_BATCHES.filter((batch) => batch.acceptingOrders);
const [CABAI, BAWANG] = OPEN;

const order = (id: string, batch: Batch): ManagedOrder => ({
  id,
  customerName: "x",
  quantity: 3,
  status: "confirmed",
  paymentStatus: "not_due",
  fulfillmentStatus: "pending",
  finalUnitPrice: null,
  createdAt: "2026-11-09T00:00:00.000Z",
  batch,
  editable: true,
});

const route = (intent: Intent, text: string, orders: ManagedOrder[] = []) => directAction(intent, extractSlots(text, { batches: OPEN, orders }));

describe("directAction", () => {
  it("pesan_baru + 1 batch + qty → confirm_join dengan qty terkonversi", () => {
    expect(route("pesan_baru", "cabe 500 gram")).toEqual({ type: "confirm_join", batchId: CABAI.id, quantity: 0.5 });
  });

  it("pesan_baru + 1 batch tanpa qty → ask_quantity", () => {
    expect(route("pesan_baru", "cabe dong")).toEqual({ type: "ask_quantity", batchId: CABAI.id });
  });

  it("pesan_baru + 0 batch → null", () => {
    expect(route("pesan_baru", "mau ikut 5 kilo")).toBeNull();
  });

  it('pesan_baru "cabe 5 kilo sama bawang 2" → choose_batch dengan 2 kandidat', () => {
    const action = route("pesan_baru", "cabe 5 kilo sama bawang 2");
    expect(action?.type).toBe("choose_batch");
    expect(action?.type === "choose_batch" && [...action.candidateBatchIds].sort()).toEqual([CABAI.id, BAWANG.id].sort());
  });

  it('pesan_baru "cabe 2 karung" untuk batch kg → ask_quantity', () => {
    expect(route("pesan_baru", "cabe 2 karung")).toEqual({ type: "ask_quantity", batchId: CABAI.id });
  });

  it("ubah_pesanan + pesanan unik + qty → confirm_change", () => {
    expect(route("ubah_pesanan", "cabe aku jadiin 8", [order("ab12cd00-0000-4000-8000-000000000001", CABAI)])).toEqual({
      type: "confirm_change",
      orderCode: "AB12CD",
      quantity: 8,
    });
  });

  it("ubah_pesanan dengan satuan yang tidak cocok → null", () => {
    expect(route("ubah_pesanan", "cabe aku jadiin 2 karung", [order("ab12cd00-0000-4000-8000-000000000001", CABAI)])).toBeNull();
  });

  it("ubah_pesanan tanpa pesanan unik → null", () => {
    const orders = [order("aaaaaa00-0000-4000-8000-000000000001", CABAI), order("bbbbbb00-0000-4000-8000-000000000001", CABAI)];
    expect(route("ubah_pesanan", "cabe aku jadiin 8", orders)).toBeNull();
  });

  it("ubah_pesanan tanpa jumlah → null", () => {
    expect(route("ubah_pesanan", "cabe aku ubah ya", [order("ab12cd00-0000-4000-8000-000000000001", CABAI)])).toBeNull();
  });

  it("batal_pesanan + pesanan unik → confirm_cancel", () => {
    expect(route("batal_pesanan", "batalin cabe", [order("ab12cd00-0000-4000-8000-000000000001", CABAI)])).toEqual({ type: "confirm_cancel", orderCode: "AB12CD" });
  });

  it("batal_pesanan tanpa pesanan → null", () => {
    expect(route("batal_pesanan", "batalin cabe")).toBeNull();
  });

  it("cek_pesanan → list_orders", () => {
    expect(route("cek_pesanan", "pesananku apa aja")).toEqual({ type: "list_orders" });
  });

  it.each(["tanya_info", "tanya_harga_pasar", "catat_minat"] as const)("%s → null", (intent) => {
    expect(route(intent, "cabe 5 kilo")).toBeNull();
  });

  it.each(["di_luar_topik", "sapaan"] as const)("%s → menu", (intent) => {
    expect(route(intent, "halo")).toEqual({ type: "menu" });
  });
});
