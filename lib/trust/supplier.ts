import { createHash } from "node:crypto";
import { isGrounded } from "@/lib/agent/stage2/grounding";
import type { BatchStatus } from "@/lib/batch";

export type SupplierFacts = {
  nama: string;
  terverifikasi: boolean;
  catatan_verifikasi: string;
  bergabung: string;
  batch_selesai: number;
  batch_ditutup: number;
  persen_batch_berhasil: number | null;
  pesanan_batch_berhasil: number;
  pesanan_diserahkan: number;
  persen_pesanan_diserahkan: number | null;
};

type FactsInput = {
  name: string;
  verified: boolean;
  verificationNote: string;
  createdAt: string;
  batches: { status: BatchStatus }[];
  /** Pesanan aktif (confirmed) di batch yang berhasil. */
  successfulOrders: { fulfillmentStatus: string }[];
};

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : null);

export function supplierFacts(input: FactsInput): SupplierFacts {
  const successful = input.batches.filter((batch) => batch.status === "successful").length;
  const closed = input.batches.filter((batch) => batch.status === "successful" || batch.status === "failed").length;
  const delivered = input.successfulOrders.filter((order) => order.fulfillmentStatus === "collected" || order.fulfillmentStatus === "delivered").length;
  return {
    nama: input.name,
    terverifikasi: input.verified,
    catatan_verifikasi: input.verificationNote,
    bergabung: input.createdAt.slice(0, 10),
    batch_selesai: successful,
    batch_ditutup: closed,
    persen_batch_berhasil: pct(successful, closed),
    pesanan_batch_berhasil: input.successfulOrders.length,
    pesanan_diserahkan: delivered,
    persen_pesanan_diserahkan: pct(delivered, input.successfulOrders.length),
  };
}

export const factsHash = (facts: SupplierFacts) => createHash("sha256").update(JSON.stringify(facts)).digest("hex");

export function templateSummary(facts: SupplierFacts): string {
  const status = facts.terverifikasi ? `${facts.nama} sudah diverifikasi manual oleh pengelola GroUp` : `${facts.nama} belum diverifikasi pengelola GroUp`;
  if (!facts.batch_ditutup) return `${status} dan belum punya riwayat batch yang ditutup.`;
  const delivered = facts.persen_pesanan_diserahkan === null ? "" : ` ${facts.pesanan_diserahkan} dari ${facts.pesanan_batch_berhasil} pesanan di batch berhasil sudah diserahkan.`;
  return `${status}. ${facts.batch_selesai} dari ${facts.batch_ditutup} batch yang ditutup berhasil mencapai kuota.${delivered}`;
}

export const SUMMARY_INSTRUCTIONS = [
  "Kamu menulis ringkasan kepercayaan supplier untuk pembeli UMKM di aplikasi patungan GroUp.",
  "Tulis 1–2 kalimat bahasa Indonesia yang netral dan jujur, hanya dari fakta JSON yang diberikan.",
  "Jangan menambah angka, tanggal, janji, atau penilaian yang tidak ada di fakta. Bila riwayat masih sedikit, katakan apa adanya.",
  "Balas hanya dengan ringkasannya, tanpa judul atau tanda kutip.",
].join(" ");

export const summaryPrompt = (facts: SupplierFacts) => `Fakta supplier:\n${JSON.stringify(facts, null, 2)}`;

export type CachedSummary = { summary: string; at: string; hash: string };
export type Summarizer = (prompt: string, signal: AbortSignal) => Promise<string>;
/** byModel: ringkasan ditulis model (bukan template), termasuk saat diambil dari cache. */
export type SummaryResult = { summary: string; source: "cache" | "model" | "template"; byModel: boolean; hash: string };

const FRESH_MS = 24 * 3_600_000;

/** Ringkasan dari cache bila masih segar; kalau tidak, dari model dengan batas waktu dan cek grounding, atau template. */
export async function resolveSummary({ facts, cached, now, summarize, timeoutMs = 5000 }: {
  facts: SupplierFacts;
  cached: CachedSummary | null;
  now: Date;
  summarize: Summarizer | null;
  timeoutMs?: number;
}): Promise<SummaryResult> {
  const hash = factsHash(facts);
  if (cached && cached.hash === hash && now.getTime() - new Date(cached.at).getTime() < FRESH_MS) {
    return { summary: cached.summary, source: "cache", byModel: cached.summary !== templateSummary(facts), hash };
  }
  if (summarize) {
    try {
      const signal = AbortSignal.timeout(timeoutMs);
      const aborted = new Promise<never>((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
      const text = (await Promise.race([summarize(summaryPrompt(facts), signal), aborted])).trim();
      if (text.length >= 20 && text.length <= 600 && isGrounded(text, [facts])) return { summary: text, source: "model", byModel: true, hash };
    } catch {
      // Error, batas waktu, atau kuota habis: jatuh ke template.
    }
  }
  return { summary: templateSummary(facts), source: "template", byModel: false, hash };
}
