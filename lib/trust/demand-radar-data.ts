import "server-only";
import { createMarketPricePort } from "@/lib/agent/adapters/market-price";
import type { MarketPrice } from "@/lib/agent/ports";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { demandRadar, type DemandInterest, type RadarEntry } from "@/lib/trust/demand-radar";

/** Radar dari semua minat aktif; nama bahan dicocokkan ke PIHPS dengan port harga pasar yang sama dengan tool agen. */
export async function loadDemandRadar(now = new Date()): Promise<RadarEntry[]> {
  const { data, error } = await createSupabaseAdminClient().from("demand_interests")
    .select("sender_key, material, quantity, unit, frequency, created_at")
    .eq("status", "active").order("created_at", { ascending: false }).limit(2000);
  if (error) throw new Error("Minat permintaan tidak dapat dimuat.");
  const interests: DemandInterest[] = data.map((row) => ({
    senderKey: row.sender_key,
    material: row.material,
    quantity: row.quantity === null ? null : Number(row.quantity),
    unit: row.unit,
    frequency: row.frequency,
    createdAt: row.created_at,
  }));
  const port = createMarketPricePort();
  const prices = new Map<string, MarketPrice | null>();
  for (const material of new Set(interests.map((interest) => interest.material))) prices.set(material, await port.lookup(material, null));
  return demandRadar(interests, now, (material) => prices.get(material) ?? null);
}
