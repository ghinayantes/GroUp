"use client";

import { useEffect, useState } from "react";

/** Hitung mundur ke deadline; dirender setelah mount agar tidak beda dengan HTML server. */
export default function Countdown({ closesAt }: { closesAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);
  const left = now === null ? null : Math.max(0, new Date(closesAt).getTime() - now);
  const parts = left === null ? null : [Math.floor(left / 86_400_000), Math.floor(left / 3_600_000) % 24, Math.floor(left / 60_000) % 60, Math.floor(left / 1000) % 60];
  return <div className="countdown" role="timer" aria-label="Sisa waktu batch">
    {["Hari", "Jam", "Menit", "Detik"].map((label, index) => <span key={label} className="countdown-unit"><b>{parts ? String(parts[index]).padStart(2, "0") : "--"}</b><small>{label}</small></span>)}
  </div>;
}
