"use client";

import { useEffect, useState } from "react";
import AiLabel from "@/components/trust/AiLabel";
import { createMarketPricePort } from "@/lib/agent/adapters/market-price";
import type { MarketPrice } from "@/lib/agent/ports";
import { rupiah, type PriceTier } from "@/lib/batch";
import { suggestTiers, tiersAtOrAboveMarket, type RadarEntry, type TierSuggestion } from "@/lib/trust/demand-radar";
import { forecastLabel, formatObservedAt } from "@/lib/trust/fair-price";

const port = createMarketPricePort();

/** Panel asisten buka batch: tampil hanya bila nama bahan dan satuan cocok dengan data PIHPS. */
export default function BatchAssistant({ name, unit, tiers, radar, onApply }: {
  name: string;
  unit: string;
  tiers: PriceTier[];
  radar: RadarEntry[];
  onApply: (suggestion: TierSuggestion) => void;
}) {
  const [market, setMarket] = useState<MarketPrice | null>(null);
  useEffect(() => {
    let active = true;
    const query = name.trim();
    (query.length < 3 ? Promise.resolve(null) : port.lookup(query, null)).then((price) => { if (active) setMarket(price); });
    return () => { active = false; };
  }, [name]);

  if (!market || market.unit.toLowerCase() !== unit.trim().toLowerCase()) return null;
  const demand = radar.find((entry) => entry.name === market.material) ?? null;
  const suggestion = suggestTiers(market, demand);
  const expensive = tiersAtOrAboveMarket(tiers, market);

  return <aside className="assistant-panel" aria-label="Asisten harga">
    <div className="fair-head"><h3>Asisten harga</h3><AiLabel /></div>
    <p>Pasar <b>{market.material}</b>: {rupiah(market.pricePerUnit)}/{market.unit} <small>({market.source} {market.region}, {formatObservedAt(market.observedAt)})</small></p>
    {market.forecast && <p><small>{forecastLabel(market.forecast)} Model {market.forecast.model}{market.forecast.validationMape !== null && `, galat validasi ${market.forecast.validationMape.toLocaleString("id-ID")}%`}.</small></p>}
    <ul className="assistant-tiers">
      {suggestion.tiers.map((tier) => <li key={tier.pct}>{tier.pct}% harga pasar: <b>{rupiah(tier.unitPrice)}</b></li>)}
      {suggestion.minimum !== null && <li>Kuota minimum: <b>{suggestion.minimum} {market.unit}</b> <small>(dari ±{demand?.weekly.find((item) => item.unit === market.unit.toLowerCase())?.quantity} {market.unit}/minggu di radar)</small></li>}
    </ul>
    <button type="button" className="button button-outline" onClick={() => onApply(suggestion)}>Pakai saran</button>
    {expensive.length > 0 && <p className="assistant-warning" role="status">{expensive.map((tier) => rupiah(tier.unitPrice)).join(", ")} sama atau di atas harga pasar. Pembeli akan melihat batch ini lebih mahal dari pasar.</p>}
  </aside>;
}
