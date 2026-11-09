import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { importPredictions, parsePredictionFile, toSnapshotRows } from "./import";

const sample = JSON.parse(readFileSync(new URL("../../test/fixtures/prediksi.json", import.meta.url), "utf8"));
const known = new Set<string>(sample.prediksi.map((p: { komoditas: string }) => p.komoditas));

const clone = () => structuredClone(sample);

describe("parsePredictionFile", () => {
  it("accepts the build-AI sample and yields 13 rows", () => {
    expect(toSnapshotRows(parsePredictionFile(sample), known)).toHaveLength(13);
  });

  it("rejects a schema version other than 1", () => {
    expect(() => parsePredictionFile({ ...clone(), skema: 2 })).toThrow(/skema/);
  });

  it("rejects a negative price", () => {
    const file = clone();
    file.prediksi[0].harga_terakhir = -1;
    expect(() => parsePredictionFile(file)).toThrow(/harga_terakhir/);
  });

  it("rejects an unknown status", () => {
    const file = clone();
    file.prediksi[0].status = "MELONJAK";
    expect(() => parsePredictionFile(file)).toThrow(/status/);
  });

  it("treats NaT and null forecast fields as missing", () => {
    const file = clone();
    Object.assign(file.prediksi[0], { tanggal_target: "NaT", prediksi: null, batas_bawah: null, batas_atas: null });
    const [row] = toSnapshotRows(parsePredictionFile(file), known);
    expect(row).toMatchObject({ target_date: null, forecast_price: null, forecast_low: null, forecast_high: null });
  });
});

describe("toSnapshotRows", () => {
  const rows = toSnapshotRows(parsePredictionFile(sample), known);
  const bawang = rows.find((r) => r.commodity_slug === "bawang_merah")!;

  it("splits sumber into source and region", () => {
    expect(bawang).toMatchObject({ source: "PIHPS", region: "kota_bandung" });
  });

  it("splits catatan into notes", () => {
    expect(bawang.notes).toEqual([
      "Data bulanan: prediksi = harga awal bulan depan, bukan harian",
      "Periode Nataru: belum ada data Nataru historis di dataset, efek musiman TIDAK dimodelkan",
    ]);
  });

  it("maps prices, forecast, and model metadata", () => {
    expect(bawang).toMatchObject({
      mode: "bulanan",
      horizon: "1_bulan",
      last_price: 35000,
      last_observed_at: "2026-11-02",
      target_date: "2026-12-01",
      forecast_price: 35000,
      forecast_low: 26000,
      forecast_high: 41100,
      status: "BERGEJOLAK",
      model: "naive",
      mape_pct: 14.98,
      n_points: 11,
    });
  });

  it("reads a local dibuat timestamp as Asia/Jakarta time", () => {
    expect(bawang.generated_at).toBe("2026-11-08T22:29:25+07:00");
  });

  it("keeps an explicit offset in dibuat", () => {
    const file = { ...clone(), dibuat: "2026-11-08T15:29:25+00:00" };
    expect(toSnapshotRows(parsePredictionFile(file), known)[0].generated_at).toBe("2026-11-08T15:29:25+00:00");
  });

  it("names every unknown commodity slug", () => {
    const partial = new Set([...known].filter((s) => s !== "daging_sapi" && s !== "bawang_putih"));
    expect(() => toSnapshotRows(parsePredictionFile(sample), partial)).toThrow(/bawang_putih, daging_sapi/);
  });
});

describe("importPredictions", () => {
  it("inserts only rows that were not imported before", async () => {
    const stored: string[] = [];
    const db = {
      listCommoditySlugs: async () => [...known],
      insertSnapshots: async (rows: { commodity_slug: string; generated_at: string }[]) => {
        const fresh = rows.filter((r) => !stored.includes(r.commodity_slug + r.generated_at));
        stored.push(...fresh.map((r) => r.commodity_slug + r.generated_at));
        return fresh.length;
      },
    };
    expect(await importPredictions(sample, db)).toEqual({ total: 13, inserted: 13 });
    expect(await importPredictions(sample, db)).toEqual({ total: 13, inserted: 0 });
  });
});
