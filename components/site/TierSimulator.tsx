"use client";

import { useState } from "react";
import { formatQuantity, rupiah } from "@/lib/batch";

/** Contoh ilustratif — bukan harga nyata. */
const example = { unit: "kg", minimum: 100, tiers: [{ minQuantity: 100, unitPrice: 40_000 }, { minQuantity: 150, unitPrice: 38_000 }, { minQuantity: 250, unitPrice: 36_500 }] };

export default function TierSimulator() {
  const [total, setTotal] = useState(120);
  const [mine, setMine] = useState(10);
  const reached = total >= example.minimum;
  const tier = example.tiers.filter((item) => item.minQuantity <= total).at(-1);
  const next = example.tiers.find((item) => item.minQuantity > total);
  return <div className="simulator">
    <div className="simulator-controls">
      <label>Total pesanan semua usaha saat batch ditutup <b>{formatQuantity(total)} {example.unit}</b>
        <input type="range" min={20} max={320} step={5} value={total} onChange={(event) => setTotal(Number(event.target.value))} />
      </label>
      <label>Pesananmu <b>{formatQuantity(mine)} {example.unit}</b>
        <input type="range" min={1} max={50} value={mine} onChange={(event) => setMine(Number(event.target.value))} />
      </label>
      <div className="simulator-tiers">
        {example.tiers.map((item) => <span key={item.minQuantity} className={item === tier ? "active" : undefined}><small>≥ {item.minQuantity} {example.unit}</small><b>{rupiah(item.unitPrice)}</b></span>)}
      </div>
    </div>
    <div className={reached ? "simulator-result ok" : "simulator-result"} aria-live="polite">
      {reached && tier ? <>
        <span className="eyebrow">Batch berhasil</span>
        <b>{rupiah(tier.unitPrice)} / {example.unit}</b>
        <p>Tagihanmu: <strong>{rupiah(tier.unitPrice * mine)}</strong> untuk {mine} {example.unit}.</p>
        <small>{next ? `Jika total mencapai ${next.minQuantity} ${example.unit}, harga turun ke ${rupiah(next.unitPrice)}.` : "Tier harga terbaik sudah tercapai."}</small>
      </> : <>
        <span className="eyebrow">Kuota minimum tidak tercapai</span>
        <b>Tidak ada tagihan</b>
        <p>Batch ditutup sebagai tidak tercapai. Pesanan disimpan sebagai riwayat, tidak diproses dan tidak dikirim.</p>
        <small>Butuh {example.minimum - total} {example.unit} lagi untuk mencapai minimum {example.minimum} {example.unit}.</small>
      </>}
    </div>
    <p className="simulator-note">Angka di atas hanya contoh. Setiap batch punya kuota dan tier sendiri yang ditetapkan pengelola bersama supplier.</p>
  </div>;
}
