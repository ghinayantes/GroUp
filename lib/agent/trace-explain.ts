import type { TraceRecord } from "./types";

const CONFIRMED_ACTIONS = new Set(["confirm_join", "confirm_change", "confirm_cancel", "confirm_interest"]);

/** Penjelasan singkat jalur dan guard yang aktif untuk satu trace, untuk panel "Di balik layar". */
export function explainTrace(trace: TraceRecord): { reason: string; guards: string[] } {
  const guards: string[] = [];
  if (CONFIRMED_ACTIONS.has(trace.action)) guards.push("Belum tersimpan sampai tombol konfirmasi ditekan");
  if (trace.stage === "stage2" && trace.action === "answer") guards.push("Angka dan bulan di jawaban dicek terhadap data tool");
  if (trace.stage === "fallback") guards.push("Balasan diganti menu karena AI tidak dipakai atau jawabannya ditolak");

  const reason = {
    fixed: "Perintah baku atau tombol, diproses sistem tanpa AI.",
    stage1: `Classifier lokal cukup yakin${trace.confidence === null ? "" : ` (${Math.round(trace.confidence * 100)}%)`}, jadi tidak perlu model bahasa.`,
    stage2: `Teks bebas diproses model bahasa${trace.model ? ` ${trace.model}` : ""}${trace.tools?.length ? `, membaca data lewat ${trace.tools.join(", ")}` : ""}.`,
    fallback: "Pesan tidak dikenali dan AI tidak dipakai untuk pesan ini.",
  }[trace.stage];
  return { reason, guards };
}
