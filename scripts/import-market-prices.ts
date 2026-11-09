import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { importPredictions, type SnapshotStore } from "../lib/market/import";

const path = process.argv[2];
if (!path) {
  console.error("Pakai: npm run harga:import -- <path/ke/prediksi.json>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Isi NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SECRET_KEY di .env.local atau environment.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const store: SnapshotStore = {
  async listCommoditySlugs() {
    const { data, error } = await supabase.from("market_commodities").select("slug");
    if (error) throw new Error(`Katalog komoditas tidak dapat dimuat: ${error.message}`);
    return data.map((row) => row.slug as string);
  },
  async insertSnapshots(rows) {
    const { data, error } = await supabase
      .from("market_price_snapshots")
      .upsert(rows, { onConflict: "commodity_slug,region,horizon,generated_at", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(`Snapshot harga tidak dapat disimpan: ${error.message}`);
    return data.length;
  },
};

try {
  const { total, inserted } = await importPredictions(JSON.parse(readFileSync(path, "utf8")), store);
  console.log(`${inserted} snapshot baru, ${total - inserted} sudah ada sebelumnya (total ${total}).`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
