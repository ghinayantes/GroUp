import { describe, expect, it } from "vitest";
import { createMemoryDeps, type MemoryOrder } from "@/lib/agent/adapters/memory";
import type { MarketPricePort, ToolContext } from "@/lib/agent/ports";
import { FIXTURE_BATCHES, FIXTURE_NOW } from "@/test/fixtures/batches";
import { ProposedActionSchema } from "./schema";
import { buildTools, formatTanggal } from "./tools";

const CABAI = FIXTURE_BATCHES[0];
const PHONE = "6281234567890";

const memoryOrder = (id: string, senderKey: string, quantity: number): MemoryOrder => ({
  id,
  channel: "whatsapp",
  senderKey,
  batchId: CABAI.id,
  customerName: "Budi Santoso",
  quantity,
  status: "confirmed",
  messageId: null,
  createdAt: FIXTURE_NOW.toISOString(),
});

function context(marketPrice: MarketPricePort = { lookup: async () => null }): ToolContext {
  const deps = createMemoryDeps({
    batches: FIXTURE_BATCHES,
    now: FIXTURE_NOW,
    orders: [memoryOrder("aaaaaa00-0000-4000-8000-000000000001", PHONE, 5), memoryOrder("bbbbbb00-0000-4000-8000-000000000001", "6289999999999", 7)],
  });
  return { orders: deps.orders, marketPrice, channel: "whatsapp", senderKey: PHONE, batches: FIXTURE_BATCHES.filter((b) => b.acceptingOrders) };
}

const run = async (tools: ReturnType<typeof buildTools>, name: keyof ReturnType<typeof buildTools>, input: unknown) =>
  (tools[name].execute as (input: unknown, options: unknown) => Promise<unknown>)(input, { toolCallId: "t1", messages: [], context: {} });

describe("formatTanggal", () => {
  it("menulis tanggal ISO dalam bahasa Indonesia", () => {
    expect(formatTanggal("2026-11-02")).toBe("2 November 2026");
    expect(formatTanggal("2026-03-15T00:00:00")).toBe("15 Maret 2026");
  });

  it("null untuk teks yang bukan tanggal", () => {
    expect(formatTanggal("NaT")).toBeNull();
  });
});

describe("buildTools", () => {
  it("pesanan_saya tidak bisa membaca pesanan pengirim lain walau input berisi senderKey lain", async () => {
    const output = await run(buildTools(context()), "pesanan_saya", { senderKey: "6289999999999" });
    expect(output).toEqual([{ kode: "AAAAAA", bahan: "Cabai Merah Keriting", jumlah: 5, satuan: "kg", status: "confirmed", bisa_diubah: true }]);
  });

  it("output tool tidak memuat nomor, nama pembeli, atau senderKey", async () => {
    const tools = buildTools(context());
    const outputs = [
      await run(tools, "detail_batch", { batchId: CABAI.id }),
      await run(tools, "pesanan_saya", {}),
      await run(tools, "cari_batch", { query: "cabe" }),
    ];
    const json = JSON.stringify(outputs);
    expect(json).not.toContain(PHONE);
    expect(json).not.toContain("Budi");
    expect(json).not.toMatch(/phone|customer|sender/i);
  });

  it("detail_batch memuat aturan dan tier batch", async () => {
    const output = (await run(buildTools(context()), "detail_batch", { batchId: CABAI.id })) as Record<string, unknown>;
    expect(output).toMatchObject({ id: CABAI.id, nama: CABAI.name, satuan: "kg", minimum: 100, pembayaran: CABAI.paymentInstructions });
    expect(output.harga).toEqual([
      { mulai_dari: 50, harga_per_satuan: 42000 },
      { mulai_dari: 100, harga_per_satuan: 38000 },
    ]);
  });

  it("detail_batch untuk id tak dikenal → ditemukan false", async () => {
    expect(await run(buildTools(context()), "detail_batch", { batchId: "nope" })).toEqual({ ditemukan: false });
  });

  it("cari_batch memakai alias dan filter kategori", async () => {
    const tools = buildTools(context());
    expect(((await run(tools, "cari_batch", { query: "cabe" })) as { nama: string }[]).map((b) => b.nama)).toEqual(["Cabai Merah Keriting"]);
    expect(((await run(tools, "cari_batch", { query: "", kategori: "sembako" })) as { nama: string }[]).map((b) => b.nama)).toEqual(["Minyak Goreng"]);
  });

  it("harga_pasar tanpa data → { tersedia: false }", async () => {
    expect(await run(buildTools(context()), "harga_pasar", { bahan: "cabai" })).toEqual({ tersedia: false });
  });

  it("harga_pasar dengan data mengembalikan harga dan sumber", async () => {
    const marketPrice: MarketPricePort = {
      lookup: async (material, region) => ({ material, region: region ?? "Kota Bandung", pricePerUnit: 45000, unit: "kg", source: "PIHPS", observedAt: "2026-11-02" }),
    };
    expect(await run(buildTools(context(marketPrice)), "harga_pasar", { bahan: "cabai" })).toEqual({
      tersedia: true,
      bahan: "cabai",
      wilayah: "Kota Bandung",
      harga_per_satuan: 45000,
      satuan: "kg",
      sumber: "PIHPS",
      tanggal: "2026-11-02",
      tanggal_teks: "2 November 2026",
    });
  });
});

describe("ProposedActionSchema", () => {
  it("menolak quantity 100001 dan type tak dikenal", () => {
    expect(ProposedActionSchema.safeParse({ type: "confirm_join", batchId: CABAI.id, quantity: 100001 }).success).toBe(false);
    expect(ProposedActionSchema.safeParse({ type: "hapus_semua" }).success).toBe(false);
  });

  it("menerima setiap bentuk ProposedAction yang valid", () => {
    const valid = [
      { type: "confirm_join", batchId: CABAI.id, quantity: 2.5 },
      { type: "ask_quantity", batchId: CABAI.id },
      { type: "choose_batch", candidateBatchIds: [CABAI.id] },
      { type: "confirm_change", orderCode: "AB12CD", quantity: 3 },
      { type: "confirm_cancel", orderCode: "AB12CD" },
      { type: "list_orders" },
      { type: "confirm_interest", material: "keju", quantity: 10, unit: "kg", frequency: "mingguan" },
      { type: "answer", text: "Pembayaran setelah kuota tercapai." },
      { type: "menu" },
    ];
    for (const action of valid) expect(ProposedActionSchema.parse(action)).toEqual(action);
  });

  it("menegakkan batas tambahan", () => {
    expect(ProposedActionSchema.safeParse({ type: "choose_batch", candidateBatchIds: ["1", "2", "3", "4", "5", "6"] }).success).toBe(false);
    expect(ProposedActionSchema.safeParse({ type: "answer", text: "x".repeat(701) }).success).toBe(false);
    expect(ProposedActionSchema.safeParse({ type: "confirm_interest", material: "k", quantity: null, unit: null, frequency: null }).success).toBe(false);
    expect(ProposedActionSchema.safeParse({ type: "confirm_join", batchId: CABAI.id, quantity: 0 }).success).toBe(false);
  });
});
