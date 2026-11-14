import { formatDeadline, formatQuantity, resolveTiers, rupiah, type Batch } from "@/lib/batch";
import type { ManagedOrder } from "@/lib/orders";
import { BUTTON, type ProposedAction, type Reply } from "./types";

export const BATCH_LIST_SECTION_TITLE = "Batch terbuka";

export const EXPIRED_TEXT = "Pilihan ini sudah kedaluwarsa. Ketik MULAI atau PESANAN ya.";
export const DISMISSED_TEXT = "Pilihan dibatalkan. Kirim MULAI kapan saja untuk melihat batch terbuka.";
export const NOTHING_TO_DISMISS_TEXT =
  "Tidak ada pilihan yang sedang berjalan. Kirim MULAI untuk melihat batch terbuka, atau BATAL <kode> untuk membatalkan pesanan.";
export const ORDER_CODE_NOT_FOUND_TEXT = "Kode pesanan tidak ditemukan di daftar pesananmu. Kirim PESANAN untuk melihat kodenya.";
export const ORDER_LOCKED_TEXT = "Batch untuk pesanan ini sudah ditutup, jadi pesanannya tidak bisa diubah atau dibatalkan lagi.";
export const BATCH_UNAVAILABLE_TEXT = "Batch tersebut sudah tidak tersedia. Kirim MULAI untuk melihat batch terbaru.";
export const ACTION_FAILED_TEXT = "Maaf, permintaanmu belum bisa diproses. Coba lagi sebentar lagi ya.";
export const AI_PREFIX = "🤖 ";
export const aiNoteText = (siteUrl: string) => `Balasan ini dibantu AI dan bisa keliru. Cara kerjanya: ${siteUrl}/transparansi-ai`;

export const text = (body: string, aiGenerated = false): Reply => ({ kind: "text", body, aiGenerated });

export const shortCode = (orderId: string) => orderId.slice(0, 6).toUpperCase();

export function quantityPrompt(batch: Batch) {
  const { tiers } = resolveTiers(batch);
  const tierText = tiers.map((tier) => `• ≥ ${formatQuantity(tier.minQuantity)} ${batch.unit}: ${rupiah(tier.unitPrice)}/${batch.unit}`).join("\n");
  return [
    `*${batch.name}* — ${batch.supplier} (${batch.verified ? "supplier terverifikasi" : "supplier belum terverifikasi"})`,
    `Terkumpul ${formatQuantity(batch.current)}/${formatQuantity(batch.minimum)} ${batch.unit} · tutup ${formatDeadline(batch.closesAt)}`,
    `Harga bertingkat:\n${tierText}`,
    `Pembayaran: ${batch.paymentInstructions || "diinformasikan setelah batch berhasil."}`,
    `Penyerahan: ${batch.fulfillmentPlan || "diinformasikan pengelola."}`,
    `Berapa ${batch.unit} yang ingin kamu pesan? Balas dengan angka (contoh 10 atau 2,5).`,
  ].join("\n\n");
}

export const describeOrder = (order: ManagedOrder) =>
  `${shortCode(order.id)} · ${order.batch.name} · ${formatQuantity(order.quantity)} ${order.batch.unit}${order.editable ? "" : " (batch sudah ditutup)"}`;

export const menuText = () =>
  "Kirim MULAI untuk memilih batch bahan baku yang terbuka, atau PESANAN untuk melihat dan mengelola pesananmu.";

export const notTextReply = () => text("Maaf, aku baru bisa baca pesan teks. Kirim dalam bentuk teks ya, atau ketik MULAI.");

export const offTopicReply = () => text("Aku cuma bisa bantu soal patungan GroUp 🙏 Ketik MULAI untuk lihat batch yang buka.");

export const greetingReply = () => text(`Halo! 👋 ${menuText()}`);

export function batchListReply(batches: Batch[], body = "Pilih batch bahan baku yang ingin kamu ikuti:"): Reply {
  if (!batches.length) return text("Belum ada batch terbuka. Coba lagi saat batch mingguan berikutnya dimulai.");
  return {
    kind: "list",
    body,
    button: "Pilih batch",
    rows: batches.map((batch) => {
      const { current } = resolveTiers(batch);
      return {
        id: batch.id,
        title: batch.name,
        description: `${rupiah(current?.unitPrice ?? 0)}/${batch.unit} · ${formatQuantity(batch.current)}/${formatQuantity(batch.minimum)} ${batch.unit}${batch.verified ? " · supplier terverifikasi" : ""}`,
      };
    }),
  };
}

export const ordersReply = (orders: ManagedOrder[]) =>
  text(orders.length
    ? `Pesanan aktifmu:\n${orders.map(describeOrder).join("\n")}\n\nUbah jumlah: UBAH <kode> <jumlah>\nBatalkan: BATAL <kode>\nContoh: UBAH ${shortCode(orders[0].id)} 12`
    : "Belum ada pesanan aktif atas namamu. Kirim MULAI untuk melihat batch terbuka.");

export const changeFormatText = (order: ManagedOrder) =>
  `Format: UBAH ${shortCode(order.id)} <jumlah>, jumlah lebih dari nol dan maksimal 100.000.`;

export const confirmJoinReply = (batch: Batch, qty: number): Reply => ({
  kind: "buttons",
  body: `Konfirmasi ${formatQuantity(qty)} ${batch.unit} ${batch.name}? Pembayaran baru diminta setelah batch berhasil ditutup pada harga final; jika kuota tidak tercapai, tidak ada tagihan.`,
  buttons: [
    { id: BUTTON.ORDER_CONFIRM, title: "Ya, ikut" },
    { id: BUTTON.DISMISS, title: "Batalkan" },
  ],
});

export const confirmChangeReply = (order: ManagedOrder, qty: number): Reply => ({
  kind: "buttons",
  body: `Ubah pesanan ${shortCode(order.id)} (${order.batch.name}) dari ${formatQuantity(order.quantity)} menjadi ${formatQuantity(qty)} ${order.batch.unit}?`,
  buttons: [
    { id: BUTTON.CHANGE_CONFIRM, title: "Ya, ubah" },
    { id: BUTTON.DISMISS, title: "Batalkan" },
  ],
});

export const confirmCancelReply = (order: ManagedOrder): Reply => ({
  kind: "buttons",
  body: `Batalkan pesanan ${describeOrder(order)}?`,
  buttons: [
    { id: BUTTON.CANCEL_CONFIRM, title: "Ya, batalkan" },
    { id: BUTTON.DISMISS, title: "Tidak jadi" },
  ],
});

type InterestAction = Extract<ProposedAction, { type: "confirm_interest" }>;

const describeInterest = (a: InterestAction) =>
  [a.material, a.quantity === null ? null : `${formatQuantity(a.quantity)}${a.unit ? ` ${a.unit}` : ""}`, a.frequency]
    .filter(Boolean)
    .join(", ");

export const confirmInterestReply = (a: InterestAction): Reply => ({
  kind: "buttons",
  body: `Catat minat patungan: ${describeInterest(a)}? Kami kabari kalau batch untuk bahan ini dibuka.`,
  buttons: [
    { id: BUTTON.INTEREST_CONFIRM, title: "Ya, catat" },
    { id: BUTTON.DISMISS, title: "Batalkan" },
  ],
});

export const orderCreatedText = (orderId: string) =>
  `Pesananmu tercatat (kode ${shortCode(orderId)}). Kami akan menginformasikan hasil batch dan harga final setelah batch ditutup. Kirim PESANAN untuk mengubah atau membatalkan selama batch masih terbuka.`;

export const orderChangedText = (order: ManagedOrder, qty: number) =>
  `Pesanan ${shortCode(order.id)} diubah menjadi ${formatQuantity(qty)} ${order.batch.unit}.`;

export const orderCancelledText = (order: ManagedOrder) => `Pesanan ${shortCode(order.id)} dibatalkan.`;

export const interestRecordedText = (material: string) =>
  `Siap, minat kamu untuk ${material} sudah dicatat. Kami kabari kalau ada batch yang cocok ya.`;
