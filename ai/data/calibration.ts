import { INTENTS, type Intent } from "@/lib/agent/types";

export const NEVER_ACCEPT = 1.01;
const Z_95 = 1.959964;

export type Scored = { confidence: number; correct: boolean };

export type IntentCalibration = {
  threshold: number;
  valPredictions: number;
  support: number;
  precision: number | null;
  wilsonLow: number | null;
  wilsonHigh: number | null;
};

export function chooseThreshold(scored: Scored[], targetPrecision = 0.97, minSupport = 5): number {
  const candidates = [...new Set(scored.map((s) => s.confidence))].sort((a, b) => a - b);
  for (const threshold of candidates) {
    const accepted = scored.filter((s) => s.confidence >= threshold);
    const precision = accepted.filter((s) => s.correct).length / accepted.length;
    if (accepted.length >= minSupport && precision >= targetPrecision) return threshold;
  }
  return NEVER_ACCEPT;
}

export function wilsonInterval(successes: number, n: number, z = Z_95): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 1 };
  const p = successes / n;
  const z2 = z * z;
  const center = (p + z2 / (2 * n)) / (1 + z2 / n);
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

export function calibrate(rows: { predicted: Intent; gold: Intent; confidence: number }[], targetPrecision = 0.97, minSupport = 5) {
  return Object.fromEntries(
    INTENTS.map((intent) => {
      const scored = rows.filter((row) => row.predicted === intent).map((row) => ({ confidence: row.confidence, correct: row.gold === intent }));
      const threshold = chooseThreshold(scored, targetPrecision, minSupport);
      const accepted = scored.filter((s) => s.confidence >= threshold);
      const correct = accepted.filter((s) => s.correct).length;
      const interval = accepted.length ? wilsonInterval(correct, accepted.length) : null;
      const calibration: IntentCalibration = {
        threshold,
        valPredictions: scored.length,
        support: accepted.length,
        precision: accepted.length ? correct / accepted.length : null,
        wilsonLow: interval?.low ?? null,
        wilsonHigh: interval?.high ?? null,
      };
      return [intent, calibration];
    }),
  ) as Record<Intent, IntentCalibration>;
}
