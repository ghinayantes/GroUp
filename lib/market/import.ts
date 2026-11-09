import { z } from "zod";

export const MARKET_STATUSES = ["STABIL", "NAIK", "TURUN", "TIDAK PASTI", "BERGEJOLAK"] as const;

const JAKARTA_OFFSET = "+07:00";

const missingToNull = (value: unknown) => (value === "NaT" || value === "nan" || value === "" ? null : value);

const optionalDate = z.preprocess(missingToNull, z.iso.date().nullable());
const optionalNumber = z.number().nullable();

const PredictionSchema = z.object({
  komoditas: z.string().regex(/^[a-z0-9_]+$/),
  horizon: z.string().min(1),
  tanggal_terakhir: z.iso.date(),
  harga_terakhir: z.number().positive(),
  tanggal_target: optionalDate,
  prediksi: z.number().positive().nullable(),
  batas_bawah: optionalNumber,
  batas_atas: optionalNumber,
  perubahan_pct: optionalNumber,
  status: z.enum(MARKET_STATUSES),
  saran: z.string(),
  model: z.string().nullable(),
  mape_validasi: optionalNumber,
  n_titik: z.number().int().nonnegative().nullable(),
  sumber: z.string().regex(/^.+ \(.+\)$/, "Format sumber harus 'SUMBER (wilayah)'"),
  catatan: z.string().nullable(),
});

export const PredictionFileSchema = z.object({
  skema: z.literal(1),
  mode: z.enum(["bulanan", "harian"]),
  dibuat: z.iso.datetime({ local: true, offset: true }),
  prediksi: z.array(PredictionSchema).min(1),
});

export type PredictionFile = z.infer<typeof PredictionFileSchema>;

export type SnapshotRow = {
  commodity_slug: string;
  region: string;
  mode: PredictionFile["mode"];
  horizon: string;
  last_price: number;
  last_observed_at: string;
  target_date: string | null;
  forecast_price: number | null;
  forecast_low: number | null;
  forecast_high: number | null;
  change_pct: number | null;
  status: (typeof MARKET_STATUSES)[number];
  advice: string;
  model: string | null;
  mape_pct: number | null;
  n_points: number | null;
  source: string;
  notes: string[];
  generated_at: string;
};

export type SnapshotStore = {
  listCommoditySlugs(): Promise<string[]>;
  insertSnapshots(rows: SnapshotRow[]): Promise<number>;
};

export function parsePredictionFile(raw: unknown): PredictionFile {
  const result = PredictionFileSchema.safeParse(raw);
  if (!result.success) throw new Error(`prediksi.json tidak valid:\n${z.prettifyError(result.error)}`);
  return result.data;
}

const withOffset = (timestamp: string) => (/(Z|[+-]\d{2}:\d{2})$/.test(timestamp) ? timestamp : timestamp + JAKARTA_OFFSET);

export function toSnapshotRows(file: PredictionFile, knownSlugs: Set<string>): SnapshotRow[] {
  const unknown = [...new Set(file.prediksi.map((p) => p.komoditas).filter((slug) => !knownSlugs.has(slug)))].sort();
  if (unknown.length > 0) {
    throw new Error(`Komoditas belum ada di market_commodities: ${unknown.join(", ")}`);
  }

  const generatedAt = withOffset(file.dibuat);
  return file.prediksi.map((p) => {
    const [, source, region] = p.sumber.match(/^(.+) \((.+)\)$/)!;
    return {
      commodity_slug: p.komoditas,
      region,
      mode: file.mode,
      horizon: p.horizon,
      last_price: p.harga_terakhir,
      last_observed_at: p.tanggal_terakhir,
      target_date: p.tanggal_target,
      forecast_price: p.prediksi,
      forecast_low: p.batas_bawah,
      forecast_high: p.batas_atas,
      change_pct: p.perubahan_pct,
      status: p.status,
      advice: p.saran,
      model: p.model,
      mape_pct: p.mape_validasi,
      n_points: p.n_titik,
      source,
      notes: (p.catatan ?? "").split("; ").map((note) => note.trim()).filter(Boolean),
      generated_at: generatedAt,
    };
  });
}

export async function importPredictions(raw: unknown, store: SnapshotStore) {
  const rows = toSnapshotRows(parsePredictionFile(raw), new Set(await store.listCommoditySlugs()));
  return { total: rows.length, inserted: await store.insertSnapshots(rows) };
}
