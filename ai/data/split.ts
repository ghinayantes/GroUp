import { normalizedDistance } from "@/lib/agent/extract";
import { INTENTS } from "@/lib/agent/types";
import type { IntentRow } from "./rows";
import { normalize } from "./validate";

const MIN_VAL_PER_INTENT = 10;

/** Satu baris per teks dari gabungan beberapa file; tulisan manusia menang atas sintetis bila teksnya sama. */
export function mergeExact(rows: IntentRow[]): { rows: IntentRow[]; duplicates: number; relabeled: number } {
  const kept = new Map<string, IntentRow>();
  let relabeled = 0;
  for (const row of rows) {
    const key = normalize(row.text);
    const existing = kept.get(key);
    if (!existing) {
      kept.set(key, row);
    } else if (existing.source === "synthetic" && row.source !== "synthetic") {
      if (existing.intent !== row.intent) relabeled++;
      kept.set(key, row);
    } else if (existing.intent !== row.intent && existing.source !== "synthetic" && row.source === "synthetic") {
      relabeled++;
    }
  }
  return { rows: [...kept.values()], duplicates: rows.length - kept.size, relabeled };
}

const MIN_CONTAINED_WORDS = 3;
const words = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Membuang baris yang hampir sama dengan referensi, atau yang memuat utuh teks referensi berisi ≥ 3 kata
 * (mis. "permisi min dftr ayam 2kg ya" memuat "dftr ayam 2kg"). Teks 1–2 kata seperti "pagi min" tidak dicek
 * sebagai potongan karena sering muncul wajar di pesan lain.
 */
export function dedupeAgainst(rows: IntentRow[], reference: IntentRow[], maxDistance = 0.15): IntentRow[] {
  const contained = reference
    .map((ref) => words(ref.text))
    .filter((text) => text.split(" ").length >= MIN_CONTAINED_WORDS)
    .map((text) => ` ${text} `);
  return rows.filter((row) => {
    const padded = ` ${words(row.text)} `;
    if (contained.some((text) => padded.includes(text))) return false;
    return !reference.some((ref) => normalizedDistance(row.text, ref.text) <= maxDistance);
  });
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function stratifiedSplit(rows: IntentRow[], valSize: number, rng: () => number): { train: IntentRow[]; val: IntentRow[] } {
  const train: IntentRow[] = [];
  const val: IntentRow[] = [];
  for (const intent of INTENTS) {
    const group = shuffle(
      rows.filter((row) => row.intent === intent),
      rng,
    );
    const wanted = Math.max(MIN_VAL_PER_INTENT, Math.round((valSize * group.length) / rows.length));
    if (group.length <= wanted) throw new Error(`Intent ${intent} hanya punya ${group.length} baris; butuh lebih dari ${wanted} untuk val.`);
    val.push(...group.slice(0, wanted));
    train.push(...group.slice(wanted));
  }
  return { train, val };
}
