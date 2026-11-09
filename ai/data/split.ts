import { normalizedDistance } from "@/lib/agent/extract";
import { INTENTS } from "@/lib/agent/types";
import type { IntentRow } from "./rows";

const MIN_VAL_PER_INTENT = 10;

export function dedupeAgainst(rows: IntentRow[], reference: IntentRow[], maxDistance = 0.15): IntentRow[] {
  return rows.filter((row) => !reference.some((ref) => normalizedDistance(row.text, ref.text) <= maxDistance));
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
