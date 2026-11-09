import { describe, expect, it } from "vitest";
import prediksi from "@/ai/harga/output/prediksi.json";
import { FIXTURE_BATCHES } from "@/test/fixtures/batches";
import { COMMODITY_NAMES, createMarketPricePort, type PriceFile } from "./market-price";

const row = (komoditas: string, harga: number, satuan = "kg") => ({ komoditas, tanggal_terakhir: "2026-11-02", harga_terakhir: harga, satuan });

const DATA: PriceFile = {
  prediksi: [
    row("cabai_merah_keriting", 94100),
    row("cabai_rawit_merah", 79850),
    row("cabai_merah_besar", 73150),
    row("bawang_merah", 35000),
    row("bawang_putih", 41250),
    row("gula_pasir", 19300),
    row("gula_pasir_kualitas_premium", 19250),
    row("minyak_goreng_curah", 21650),
    row("daging_ayam_ras", 41500),
    row("telur_ayam_ras", 25250),
  ],
};

const port = createMarketPricePort(DATA);

describe("createMarketPricePort", () => {
  it("memetakan nama batch ke komoditas PIHPS dengan harga terakhir", async () => {
    expect(await port.lookup("Cabai Merah Keriting", null)).toEqual({
      material: "Cabai Merah Keriting",
      region: "Kota Bandung",
      pricePerUnit: 94100,
      unit: "kg",
      source: "PIHPS",
      observedAt: "2026-11-02",
    });
  });

  it.each([
    ["bawmer", "Bawang Merah"],
    ["gula", "Gula Pasir"],
    ["gula pasir premium", "Gula Pasir Premium"],
    ["minyak", "Minyak Goreng Curah"],
    ["daging ayam", "Daging Ayam Ras"],
    ["telor", "Telur Ayam Ras"],
  ])("%s → %s", async (query, material) => {
    expect((await port.lookup(query, null))?.material).toBe(material);
  });

  it.each(["cabe", "bawang", "ayam"])("%s ambigu → null", async (query) => {
    expect(await port.lookup(query, null)).toBeNull();
  });

  it("bahan tanpa data → null", async () => {
    expect(await port.lookup("tepung terigu", null)).toBeNull();
  });

  it("satuan sumber dipertahankan (minyak dari PIHPS per kg)", async () => {
    expect((await port.lookup("Minyak Goreng", null))?.unit).toBe("kg");
  });

  it("wilayah selain Bandung → null, Bandung diterima", async () => {
    expect(await port.lookup("bawang merah", "Surabaya")).toBeNull();
    expect(await port.lookup("bawang merah", "Kota Bogor")).toBeNull();
    expect(await port.lookup("bawang merah", "Kabupaten Bandung")).toBeNull();
    expect((await port.lookup("bawang merah", "Kota Bandung"))?.pricePerUnit).toBe(35000);
    expect((await port.lookup("bawang merah", "bandung"))?.pricePerUnit).toBe(35000);
  });

  it("setiap komoditas di prediksi.json punya nama tampilan", () => {
    for (const { komoditas } of prediksi.prediksi) expect(COMMODITY_NAMES[komoditas], komoditas).toBeTruthy();
  });

  it("data asli: batch fixture yang punya seri PIHPS ditemukan", async () => {
    const real = createMarketPricePort();
    const found = await Promise.all(FIXTURE_BATCHES.map(async (batch) => [batch.name, (await real.lookup(batch.name, null))?.material ?? null]));
    expect(Object.fromEntries(found)).toEqual({
      "Cabai Merah Keriting": "Cabai Merah Keriting",
      "Bawang Merah": "Bawang Merah",
      "Tepung Terigu Protein Tinggi": null,
      "Minyak Goreng": "Minyak Goreng Curah",
      "Gula Pasir": "Gula Pasir",
    });
  });
});
