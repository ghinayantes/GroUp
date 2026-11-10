import { describe, expect, it } from "vitest";
import { explainTrace } from "./trace-explain";
import type { TraceRecord } from "./types";

const trace = (extra: Partial<TraceRecord>): TraceRecord => ({
  stage: "fixed", intent: null, confidence: null, action: "fixed", model: null, inputTokens: null, outputTokens: null, latencyMs: 5, ...extra,
});

describe("explainTrace", () => {
  it("perintah baku tanpa guard", () => {
    expect(explainTrace(trace({}))).toEqual({ reason: "Perintah baku atau tombol, diproses sistem tanpa AI.", guards: [] });
  });

  it("usulan pesanan dari tahap 1 menunggu konfirmasi", () => {
    const { reason, guards } = explainTrace(trace({ stage: "stage1", confidence: 0.973, action: "confirm_join" }));
    expect(reason).toContain("97%");
    expect(guards).toEqual(["Belum tersimpan sampai tombol konfirmasi ditekan"]);
  });

  it("jawaban tahap 2 menyebut model, tool, dan guard grounding", () => {
    const { reason, guards } = explainTrace(trace({ stage: "stage2", action: "answer", model: "google/gemini", tools: ["harga_pasar"] }));
    expect(reason).toBe("Teks bebas diproses model bahasa google/gemini, membaca data lewat harga_pasar.");
    expect(guards).toEqual(["Angka dan bulan di jawaban dicek terhadap data tool"]);
  });

  it("fallback menjelaskan menu cadangan", () => {
    expect(explainTrace(trace({ stage: "fallback", action: "menu" })).guards).toHaveLength(1);
  });
});
