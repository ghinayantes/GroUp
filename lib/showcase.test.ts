import { describe, expect, it } from "vitest";
import { FIXTURE_BATCHES } from "@/test/fixtures/batches";
import { marketGap } from "./showcase";

describe("marketGap", () => {
  const fair = (savingPct: number) => ({ batchPrice: 1, bestPrice: null, marketPrice: 1, savingPct, unit: "kg", source: "PIHPS", region: "Kota Bandung", observedAt: "2026-11-02", forecast: null });

  it("hanya batch terbuka dengan data pasar, selisih terbesar dulu", () => {
    const [a, b, c] = FIXTURE_BATCHES;
    const gap = marketGap([{ ...a, fairPrice: fair(3) }, { ...b, fairPrice: fair(8) }, { ...c, fairPrice: null }]);
    expect(gap.map((batch) => batch.fairPrice.savingPct)).toEqual([8, 3]);
  });

  it("tanpa batch dengan data pasar → kosong (bagian disembunyikan)", () => {
    expect(marketGap(FIXTURE_BATCHES)).toEqual([]);
  });
});
