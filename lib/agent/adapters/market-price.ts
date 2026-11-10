import prediksi from "@/ai/harga/output/prediksi.json";
import { nameMatchScore } from "../extract";
import type { MarketForecast, MarketPrice, MarketPricePort } from "../ports";

type PriceRow = {
  komoditas: string;
  tanggal_terakhir: string;
  harga_terakhir: number;
  satuan: string;
  tanggal_target?: string | null;
  prediksi?: number | null;
  batas_bawah?: number | null;
  batas_atas?: number | null;
  perubahan_pct?: number | null;
  status?: string | null;
  mape_validasi?: number | null;
  model?: string | null;
};

export type PriceFile = { prediksi: PriceRow[] };

const FORECAST_STATUS = new Set(["NAIK", "TURUN", "STABIL", "BERGEJOLAK", "TIDAK PASTI"]);

function forecastOf(row: PriceRow): MarketForecast | null {
  const { tanggal_target, prediksi, batas_bawah, batas_atas, perubahan_pct, status, model } = row;
  if (!tanggal_target || prediksi == null || batas_bawah == null || batas_atas == null || perubahan_pct == null || !status || !FORECAST_STATUS.has(status) || !model) return null;
  return {
    targetDate: tanggal_target,
    price: prediksi,
    low: batas_bawah,
    high: batas_atas,
    changePct: perubahan_pct,
    status: status as MarketForecast["status"],
    validationMape: row.mape_validasi ?? null,
    model,
  };
}

export const COMMODITY_NAMES: Record<string, string> = {
  beras_medium: "Beras Medium",
  gula_pasir: "Gula Pasir",
  gula_pasir_kualitas_premium: "Gula Pasir Premium",
  minyak_goreng_curah: "Minyak Goreng Curah",
  telur_ayam_ras: "Telur Ayam Ras",
  daging_ayam_ras: "Daging Ayam Ras",
  daging_sapi: "Daging Sapi",
  cabai_merah_keriting: "Cabai Merah Keriting",
  cabai_merah_besar: "Cabai Merah Besar",
  cabai_rawit_merah: "Cabai Rawit Merah",
  cabai_rawit_hijau: "Cabai Rawit Hijau",
  bawang_merah: "Bawang Merah",
  bawang_putih: "Bawang Putih",
};

const REGION = "Kota Bandung";

const isRegion = (region: string) => {
  const words = region.toLowerCase().match(/\p{L}+/gu) ?? [];
  return words.filter((word) => word !== "kota").join(" ") === "bandung";
};
const SOURCE = "PIHPS";

export function createMarketPricePort(data: PriceFile = prediksi): MarketPricePort {
  const prices: MarketPrice[] = data.prediksi
    .filter((row) => COMMODITY_NAMES[row.komoditas])
    .map((row) => ({
      material: COMMODITY_NAMES[row.komoditas],
      region: REGION,
      pricePerUnit: row.harga_terakhir,
      unit: row.satuan,
      source: SOURCE,
      observedAt: row.tanggal_terakhir,
      forecast: forecastOf(row),
    }));

  return {
    async lookup(material, region) {
      if (region && !isRegion(region)) return null;
      const scored = prices.map((price) => {
        const score = nameMatchScore(material, price.material);
        return { price, score, matched: Math.round(score * price.material.split(" ").length) };
      });
      const best = Math.max(0, ...scored.map((s) => s.score));
      const top = scored.filter((s) => s.score === best);
      const most = Math.max(...top.map((s) => s.matched));
      const winners = top.filter((s) => s.matched === most);
      return best > 0 && winners.length === 1 ? winners[0].price : null;
    },
  };
}
