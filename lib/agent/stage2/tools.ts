import { tool } from "ai";
import { z } from "zod";
import type { Batch } from "@/lib/batch";
import { shortCode } from "../copy";
import { matchBatches } from "../extract";
import type { ToolContext } from "../ports";
import { MONTHS } from "./grounding";

export function formatTanggal(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  const month = match && MONTHS[Number(match[2]) - 1];
  if (!match || !month) return null;
  return `${Number(match[3])} ${month[0].toUpperCase()}${month.slice(1)} ${match[1]}`;
}

const summary = (batch: Batch) => ({
  id: batch.id,
  nama: batch.name,
  kategori: batch.category,
  satuan: batch.unit,
  terkumpul: batch.current,
  minimum: batch.minimum,
  tutup: batch.closesAt,
});

const detail = (batch: Batch) => ({
  ...summary(batch),
  harga: batch.tiers.map((tier) => ({ mulai_dari: tier.minQuantity, harga_per_satuan: tier.unitPrice })),
  harga_final: batch.finalUnitPrice,
  menerima_pesanan: batch.acceptingOrders,
  pembayaran: batch.paymentInstructions,
  penyerahan: batch.fulfillmentPlan,
});

export function buildTools(ctx: ToolContext) {
  return {
    cari_batch: tool({
      description: "Cari batch patungan yang sedang buka berdasarkan nama bahan (boleh singkatan/salah ketik) dan kategori opsional.",
      inputSchema: z.object({ query: z.string().max(100), kategori: z.string().max(60).optional() }),
      execute: async ({ query, kategori }) => {
        const found = query.trim() ? matchBatches(query, ctx.batches) : ctx.batches;
        const filtered = kategori ? found.filter((batch) => batch.category.toLowerCase().includes(kategori.toLowerCase())) : found;
        return filtered.map(summary);
      },
    }),
    detail_batch: tool({
      description: "Detail satu batch: tier harga, progres, deadline, aturan pembayaran dan penyerahan.",
      inputSchema: z.object({ batchId: z.string().max(64) }),
      execute: async ({ batchId }) => {
        const batch = ctx.batches.find((b) => b.id === batchId);
        return batch ? detail(batch) : { ditemukan: false as const };
      },
    }),
    pesanan_saya: tool({
      description: "Daftar pesanan milik pembeli yang sedang chat. Tidak menerima parameter.",
      inputSchema: z.object({}),
      execute: async () => {
        const orders = await ctx.orders.listOrders(ctx.channel, ctx.senderKey);
        return orders.map((order) => ({
          kode: shortCode(order.id),
          bahan: order.batch.name,
          jumlah: order.quantity,
          satuan: order.batch.unit,
          status: order.status,
          bisa_diubah: order.editable,
        }));
      },
    }),
    harga_pasar: tool({
      description: "Harga pasar terkini suatu bahan (data resmi). Mengembalikan tersedia=false bila data tidak ada.",
      inputSchema: z.object({ bahan: z.string().max(100), wilayah: z.string().max(100).optional() }),
      execute: async ({ bahan, wilayah }) => {
        const price = await ctx.marketPrice.lookup(bahan, wilayah ?? null);
        if (!price) return { tersedia: false as const };
        return {
          tersedia: true as const,
          bahan: price.material,
          wilayah: price.region,
          harga_per_satuan: price.pricePerUnit,
          satuan: price.unit,
          sumber: price.source,
          tanggal: price.observedAt,
          tanggal_teks: formatTanggal(price.observedAt),
        };
      },
    }),
  };
}
