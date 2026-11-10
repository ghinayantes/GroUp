import Link from "next/link";
import type { EvalHighlights } from "@/lib/showcase";

const pct = (value: number | null) => (value === null ? null : `${(Math.round(value * 1000) / 10).toLocaleString("id-ID")}%`);

export default function MetricsStrip({ highlights }: { highlights: EvalHighlights | null }) {
  if (!highlights) return null;
  const items = [
    { label: "Aksi tersimpan tanpa konfirmasi", value: highlights.violations === null ? null : String(highlights.violations) },
    { label: "Aksi end-to-end benar", value: pct(highlights.e2eCorrect) },
    { label: "Panggilan LLM dihemat router", value: pct(highlights.llmCallsSaved) },
    { label: "Presisi classifier lokal", value: pct(highlights.stage1Precision) },
  ].filter((item): item is { label: string; value: string } => item.value !== null);
  if (!items.length) return null;
  return <section className="section metrics-strip" aria-label="Hasil evaluasi agen">
    {items.map((item) => <div key={item.label}><b>{item.value}</b><small>{item.label}</small></div>)}
    <p>Diukur dengan pesan tulisan manusia, eval {highlights.date}. <Link href="/transparansi-ai" className="text-link">Cara mengukurnya</Link></p>
  </section>;
}
