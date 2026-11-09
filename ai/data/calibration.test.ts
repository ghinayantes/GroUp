import { describe, expect, it } from "vitest";
import { calibrate, chooseThreshold, wilsonInterval } from "./calibration";

const scored = (pairs: [number, boolean][]) => pairs.map(([confidence, correct]) => ({ confidence, correct }));

describe("chooseThreshold", () => {
  it("memilih 0.8 untuk data dengan presisi 1.0 di ≥0.8 dan 0.9 di ≥0.6", () => {
    const data = scored([
      [0.95, true],
      [0.92, true],
      [0.9, true],
      [0.85, true],
      [0.8, true],
      [0.75, false],
      [0.7, true],
      [0.68, true],
      [0.65, true],
      [0.6, true],
    ]);
    expect(chooseThreshold(data)).toBe(0.8);
  });

  it("mengembalikan 1.01 bila support kurang dari 5", () => {
    expect(chooseThreshold(scored([[0.99, true], [0.98, true], [0.97, true], [0.96, true]]))).toBe(1.01);
  });

  it("mengembalikan 1.01 bila presisi target tidak pernah tercapai", () => {
    expect(chooseThreshold(scored(Array.from({ length: 10 }, (_, i) => [0.9 - i * 0.01, i % 2 === 0] as [number, boolean])))).toBe(1.01);
  });
});

describe("wilsonInterval", () => {
  it("cocok dengan nilai referensi 95%", () => {
    const { low, high } = wilsonInterval(30, 30);
    expect(low).toBeCloseTo(0.8865, 3);
    expect(high).toBeCloseTo(1, 6);
    const mid = wilsonInterval(8, 10);
    expect(mid.low).toBeCloseTo(0.4902, 3);
    expect(mid.high).toBeCloseTo(0.9433, 3);
  });

  it("interval kosong untuk n = 0", () => {
    expect(wilsonInterval(0, 0)).toEqual({ low: 0, high: 1 });
  });
});

describe("calibrate", () => {
  it("menghitung ambang dan statistik per intent dari prediksi", () => {
    const rows = [
      ...Array.from({ length: 6 }, () => ({ predicted: "sapaan" as const, gold: "sapaan" as const, confidence: 0.9 })),
      { predicted: "sapaan" as const, gold: "di_luar_topik" as const, confidence: 0.5 },
      { predicted: "pesan_baru" as const, gold: "pesan_baru" as const, confidence: 0.99 },
    ];
    const result = calibrate(rows);
    expect(result.sapaan).toMatchObject({ threshold: 0.9, support: 6, precision: 1 });
    expect(result.sapaan.wilsonLow).toBeCloseTo(wilsonInterval(6, 6).low);
    expect(result.pesan_baru).toMatchObject({ threshold: 1.01, support: 0, precision: null, wilsonLow: null });
    expect(result.tanya_info).toMatchObject({ threshold: 1.01, valPredictions: 0 });
  });
});
