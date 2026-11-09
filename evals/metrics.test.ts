import { describe, expect, it } from "vitest";
import { accuracy, confusion, costPer1000, macroF1, percentile } from "./metrics";

const pairs = (list: [string, string][]) => list.map(([gold, predicted]) => ({ gold, predicted }));

describe("metrics", () => {
  it("macroF1 dua kelas seimbang sempurna = 1", () => {
    expect(macroF1(pairs([["a", "a"], ["b", "b"], ["a", "a"], ["b", "b"]]), ["a", "b"])).toBe(1);
  });

  it("macroF1 dengan satu kelas tak pernah diprediksi menghitung F1 0 untuk kelas itu", () => {
    // a: P=2/3, R=1 → F1 0,8; b: tidak pernah diprediksi → 0
    expect(macroF1(pairs([["a", "a"], ["a", "a"], ["b", "a"]]), ["a", "b"])).toBeCloseTo(0.4);
  });

  it("percentile([1..100], 95) = 95", () => {
    expect(percentile(Array.from({ length: 100 }, (_, i) => i + 1), 95)).toBe(95);
    expect(percentile([5, 1, 3], 50)).toBe(3);
    expect(percentile([], 95)).toBeNull();
  });

  it("accuracy dan confusion", () => {
    const data = pairs([["a", "a"], ["a", "b"], ["b", "b"], ["b", "b"]]);
    expect(accuracy(data)).toBe(0.75);
    expect(accuracy([])).toBeNull();
    expect(confusion(data, ["a", "b"])).toEqual({ a: { a: 1, b: 1 }, b: { a: 0, b: 2 } });
  });

  it("costPer1000 dari token rata-rata dan harga per juta token", () => {
    expect(costPer1000({ inputTokens: 1000, outputTokens: 200, messages: 10 }, { inputPerMillion: 1, outputPerMillion: 5 })).toBeCloseTo(0.2);
    expect(costPer1000({ inputTokens: 0, outputTokens: 0, messages: 0 }, { inputPerMillion: 1, outputPerMillion: 5 })).toBe(0);
  });
});
