import { describe, expect, it } from "vitest";
import { DEMO_SCENARIOS, DEMO_STEPS, activeStep } from "./demo-clips";

const timing = { duration: 10, steps: [0.5, 3, 6, 7.6] };

describe("activeStep", () => {
  it("memilih langkah terakhir yang sudah dimulai", () => {
    expect(activeStep(timing, 0)).toBe(0);
    expect(activeStep(timing, 3)).toBe(1);
    expect(activeStep(timing, 6.5)).toBe(2);
    expect(activeStep(timing, 9.9)).toBe(3);
  });

  it("langkah pertama bila waktu klip belum ada", () => {
    expect(activeStep(undefined, 5)).toBe(0);
  });
});

describe("DEMO_SCENARIOS", () => {
  it("setiap skenario punya teks untuk semua langkah dan id unik", () => {
    expect(new Set(DEMO_SCENARIOS.map((s) => s.id)).size).toBe(DEMO_SCENARIOS.length);
    for (const scenario of DEMO_SCENARIOS) expect(scenario.steps).toHaveLength(DEMO_STEPS.length);
  });
});
