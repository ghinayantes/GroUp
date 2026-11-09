export type Pair = { gold: string; predicted: string };

export function accuracy(pairs: Pair[]): number | null {
  if (!pairs.length) return null;
  return pairs.filter((p) => p.gold === p.predicted).length / pairs.length;
}

export function macroF1(pairs: Pair[], labels: readonly string[]): number | null {
  if (!pairs.length) return null;
  const f1s = labels.map((label) => {
    const tp = pairs.filter((p) => p.gold === label && p.predicted === label).length;
    const fp = pairs.filter((p) => p.gold !== label && p.predicted === label).length;
    const fn = pairs.filter((p) => p.gold === label && p.predicted !== label).length;
    return tp === 0 ? 0 : (2 * tp) / (2 * tp + fp + fn);
  });
  return f1s.reduce((sum, f1) => sum + f1, 0) / labels.length;
}

export function confusion(pairs: Pair[], labels: readonly string[]): Record<string, Record<string, number>> {
  const matrix = Object.fromEntries(labels.map((gold) => [gold, Object.fromEntries(labels.map((predicted) => [predicted, 0]))]));
  for (const { gold, predicted } of pairs) if (matrix[gold] && predicted in matrix[gold]) matrix[gold][predicted] += 1;
  return matrix;
}

export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

export type Pricing = { inputPerMillion: number; outputPerMillion: number };

export function costPer1000(usage: { inputTokens: number; outputTokens: number; messages: number }, pricing: Pricing): number {
  if (!usage.messages) return 0;
  const total = (usage.inputTokens * pricing.inputPerMillion + usage.outputTokens * pricing.outputPerMillion) / 1_000_000;
  return (total / usage.messages) * 1000;
}
