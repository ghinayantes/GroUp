import { describe, expect, it, vi } from "vitest";
import { factsHash, resolveSummary, supplierFacts, templateSummary } from "./supplier";

const facts = supplierFacts({
  name: "Grosir Demo",
  verified: true,
  verificationNote: "NIB dicek",
  createdAt: "2026-07-13T02:00:00Z",
  batches: [{ status: "successful" }, { status: "successful" }, { status: "successful" }, { status: "failed" }, { status: "open" }],
  successfulOrders: [{ fulfillmentStatus: "collected" }, { fulfillmentStatus: "collected" }, { fulfillmentStatus: "ready" }, { fulfillmentStatus: "delivered" }],
});
const now = new Date("2026-11-10T00:00:00Z");

describe("supplierFacts", () => {
  it("menghitung persentase dari batch ditutup dan pesanan di batch berhasil", () => {
    expect(facts).toMatchObject({ batch_selesai: 3, batch_ditutup: 4, persen_batch_berhasil: 75, pesanan_batch_berhasil: 4, pesanan_diserahkan: 3, persen_pesanan_diserahkan: 75, bergabung: "2026-07-13" });
  });

  it("tanpa riwayat → persentase null dan template jujur", () => {
    const empty = supplierFacts({ name: "Baru", verified: false, verificationNote: "", createdAt: "2026-11-01T00:00:00Z", batches: [], successfulOrders: [] });
    expect(empty.persen_batch_berhasil).toBeNull();
    expect(templateSummary(empty)).toBe("Baru belum diverifikasi pengelola GroUp dan belum punya riwayat batch yang ditutup.");
  });
});

describe("resolveSummary", () => {
  it("ringkasan model yang berpijak pada fakta dipakai", async () => {
    const summarize = vi.fn().mockResolvedValue("Grosir Demo terverifikasi dan 3 dari 4 batch yang ditutup berhasil, dengan 75% pesanan sudah diserahkan.");
    const result = await resolveSummary({ facts, cached: null, now, summarize });
    expect(result.source).toBe("model");
    expect(summarize.mock.calls[0][0]).toContain("\"persen_batch_berhasil\": 75");
  });

  it("angka karangan → template", async () => {
    const result = await resolveSummary({ facts, cached: null, now, summarize: async () => "Grosir Demo sudah melayani 1.250 pembeli dengan kepuasan 98%." });
    expect(result).toMatchObject({ source: "template", summary: templateSummary(facts) });
  });

  it("bulan karangan → template", async () => {
    const result = await resolveSummary({ facts, cached: null, now, summarize: async () => "Grosir Demo bergabung sejak Maret dan rekam jejaknya baik sekali." });
    expect(result.source).toBe("template");
  });

  it("error atau tahap 2 mati → template", async () => {
    expect((await resolveSummary({ facts, cached: null, now, summarize: async () => { throw new Error("quota"); } })).source).toBe("template");
    expect((await resolveSummary({ facts, cached: null, now, summarize: null })).source).toBe("template");
  });

  it("lewat batas waktu → template walau model mengabaikan signal", async () => {
    const slow = () => new Promise<string>(() => {});
    expect((await resolveSummary({ facts, cached: null, now, summarize: slow, timeoutMs: 10 })).source).toBe("template");
  });

  it("cache masih segar dengan hash sama → model tidak dipanggil", async () => {
    const summarize = vi.fn();
    const cached = { summary: "Ringkasan lama dari cache.", at: "2026-11-09T12:00:00Z", hash: factsHash(facts) };
    expect(await resolveSummary({ facts, cached, now, summarize })).toMatchObject({ source: "cache", byModel: true, summary: "Ringkasan lama dari cache." });
    expect((await resolveSummary({ facts, cached: { ...cached, summary: templateSummary(facts) }, now, summarize })).byModel).toBe(false);
    expect(summarize).not.toHaveBeenCalled();
  });

  it("cache basi atau fakta berubah → dibuat ulang", async () => {
    const summarize = vi.fn().mockResolvedValue("Grosir Demo terverifikasi dengan 3 batch selesai.");
    await resolveSummary({ facts, cached: { summary: "x", at: "2026-11-08T00:00:00Z", hash: factsHash(facts) }, now, summarize });
    await resolveSummary({ facts, cached: { summary: "x", at: "2026-11-09T23:00:00Z", hash: "lama" }, now, summarize });
    expect(summarize).toHaveBeenCalledTimes(2);
  });
});
