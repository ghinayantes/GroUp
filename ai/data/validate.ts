import { INTENTS, type Intent } from "@/lib/agent/types";
import { SOURCES, type IntentRow } from "./rows";

export type ValidationRules = { allowedSources: IntentRow["source"][]; minTotal: number; minPerIntent: number; maxLength: number };

export const TEST_SET_RULES: ValidationRules = { allowedSources: ["team", "umkm"], minTotal: 150, minPerIntent: 15, maxLength: 1000 };

export const TRAIN_SOURCE_RULES: ValidationRules = { allowedSources: [...SOURCES], minTotal: 0, minPerIntent: 0, maxLength: 1000 };

export const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

export function validateRows(rows: unknown[], rules: ValidationRules): { errors: string[]; counts: Record<Intent, number> } {
  const errors: string[] = [];
  const counts = Object.fromEntries(INTENTS.map((intent) => [intent, 0])) as Record<Intent, number>;
  const seen = new Map<string, number>();

  rows.forEach((raw, index) => {
    const line = index + 1;
    if (typeof raw !== "object" || raw === null) {
      errors.push(`baris ${line}: harus berupa objek { text, intent, source }`);
      return;
    }
    const row = raw as Record<string, unknown>;
    if (typeof row.text !== "string" || row.text.trim() === "" || row.text.length > rules.maxLength) {
      errors.push(`baris ${line}: text harus string 1–${rules.maxLength} karakter`);
      return;
    }
    if (!INTENTS.includes(row.intent as Intent)) {
      errors.push(`baris ${line}: intent "${String(row.intent)}" tidak dikenal`);
      return;
    }
    if (!rules.allowedSources.includes(row.source as IntentRow["source"])) {
      errors.push(`baris ${line}: source "${String(row.source)}" tidak diizinkan (${rules.allowedSources.join(", ")})`);
      return;
    }
    const key = normalize(row.text);
    const first = seen.get(key);
    if (first) {
      errors.push(`baris ${line}: duplikat baris ${first}`);
      return;
    }
    seen.set(key, line);
    counts[row.intent as Intent] += 1;
  });

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (total < rules.minTotal) errors.push(`total ${total} baris valid; minimal ${rules.minTotal}`);
  for (const intent of INTENTS) {
    if (counts[intent] < rules.minPerIntent) errors.push(`${intent}: ${counts[intent]} baris; minimal ${rules.minPerIntent}`);
  }
  return { errors, counts };
}
