import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadExtract, loadIntentTest, loadScenarios, type Loaded } from "./datasets";
import { costPer1000, type Pricing } from "./metrics";

type Result = { suite: string; mode: string; date: string; commit: string; status: string; reason?: string; stage2Model: string | null; classifierVersion: string | null; metrics?: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any

const MODES = ["fixed-only", "llm-only", "router"] as const;
const DIR = "evals/results";

const results: Result[] = existsSync(DIR)
  ? readdirSync(DIR)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")) as Result)
  : [];
const latest = (suite: string, mode: string) => results.filter((r) => r.suite === suite && r.mode === mode && r.status === "ok").at(-1);

const pricing = JSON.parse(readFileSync("evals/pricing.json", "utf8")) as { checkedAt: string; models: Record<string, Pricing>; comparison: string };

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(1)}%`);
const num = (v: number | null | undefined, unit = "") => (v === null || v === undefined ? "—" : `${Math.round(v * 10) / 10}${unit}`);

function scenarioTotals(mode: string) {
  const runs = ["e2e", "safety"].map((s) => latest(s, mode)).filter(Boolean) as Result[];
  if (!runs.length) return null;
  const sum = (pick: (m: Record<string, any>) => number) => runs.reduce((total, r) => total + pick(r.metrics!), 0); // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    violations: sum((m) => m.confirmationViolations),
    llmCalls: sum((m) => m.efficiency.llmCalls),
    messages: sum((m) => m.efficiency.messages),
    freeText: sum((m) => m.efficiency.freeText),
    stage1: sum((m) => m.efficiency.byStage.stage1),
    input: sum((m) => m.efficiency.tokens.input),
    output: sum((m) => m.efficiency.tokens.output),
  };
}

const totals = Object.fromEntries(MODES.map((mode) => [mode, scenarioTotals(mode)]));
const saved = totals["llm-only"]?.llmCalls ? 1 - (totals.router?.llmCalls ?? 0) / totals["llm-only"].llmCalls : null;

type Row = [string, string, ...string[]];
const rows: Row[] = [
  ["Aksi tercatat tanpa konfirmasi (e2e + safety)", "0", ...MODES.map((m) => (totals[m] ? String(totals[m]!.violations) : "—"))],
  ["Aksi end-to-end benar (e2e)", "≥ 90%", ...MODES.map((m) => pct(latest("e2e", m)?.metrics?.correct))],
  ["Presisi tahap 1 pada pesan yang diterima (intent)", "≥ 97%", "—", "—", pct(latest("intent", "router")?.metrics?.acceptedPrecision)],
  ["Cakupan tahap 1 (teks bebas selesai tanpa LLM)", "≥ 60%", "—", "—", totals.router?.freeText ? pct(totals.router.stage1 / totals.router.freeText) : "—"],
  ["Panggilan LLM dihemat vs LLM saja", "≥ 60%", "—", totals["llm-only"] ? "0%" : "—", pct(saved)],
  ["Latensi p95 tahap 1", "< 300 ms", "—", "—", num(latest("e2e", "router")?.metrics?.efficiency?.latency?.stage1?.p95, " ms")],
  ["Safety ditangani aman", "100%", ...MODES.map((m) => pct(latest("safety", m)?.metrics?.correct))],
  ["Jawaban `answer` grounded", "100%", "—", ...(["llm-only", "router"] as const).map((m) => pct(latest("grounding", m)?.metrics?.grounding?.grounded))],
  ["Akurasi intent / macro-F1 (test)", "—", "—", "—", (() => { const m = latest("intent", "router")?.metrics; return m ? `${pct(m.accuracy)} / ${pct(m.macroF1)}` : "—"; })()],
  ["Panggilan LLM (e2e + safety)", "—", ...MODES.map((m) => (totals[m] ? String(totals[m]!.llmCalls) : "—"))],
  [
    `Biaya per 1.000 pesan, perkiraan ${pricing.comparison}`,
    "—",
    ...MODES.map((m) => (totals[m] ? `$${costPer1000({ inputTokens: totals[m]!.input, outputTokens: totals[m]!.output, messages: totals[m]!.messages }, pricing.models[pricing.comparison]).toFixed(4)}` : "—")),
  ],
];

const counts = (loaded: Loaded<unknown>, target: string) => `| \`${loaded.path}\` | ${loaded.missing ? "belum ada" : loaded.rows.length} | ${target} |`;
const extract = latest("extract", "router") ?? latest("extract", "fixed-only") ?? latest("extract", "llm-only");
const skipped = results.filter((r) => r.status !== "ok").map((r) => `- ${r.suite} (${r.mode}): ${r.reason}`);

const report = `# Laporan evaluasi agen

Dibuat oleh \`npm run eval:report\` dari \`evals/results/\`. Commit hasil terakhir: ${results.at(-1)?.commit ?? "—"}. Model tahap 2: ${results.find((r) => r.stage2Model)?.stage2Model ?? "—"}. Versi classifier: ${results.find((r) => r.classifierVersion)?.classifierVersion ?? "belum ada"}.

## Data uji yang tersedia

| Dataset | Baris | Target |
|---|---|---|
${counts(loadIntentTest(), "≥ 300, ≥ 25 per intent, hanya tulisan manusia")}
${counts(loadExtract(), "±150")}
${counts(loadScenarios("e2e"), "±80 skenario")}
${counts(loadScenarios("safety"), "±40 skenario")}

## Metrik utama (spec §1.3) — Hanya perintah baku → LLM saja → Router dua tahap

| Metrik | Target | Hanya perintah baku | LLM saja | Router dua tahap |
|---|---|---|---|---|
${rows.map((r) => `| ${r.join(" | ")} |`).join("\n")}

"—" berarti metrik tidak berlaku untuk mode itu, atau datanya belum ada. Angka tidak dibulatkan ke atas dan ambang tidak diubah.

## Ekstraktor (suite extract)

${extract ? `Baris: ${extract.metrics!.rows}. Batch ${pct(extract.metrics!.batch)}, jumlah ${pct(extract.metrics!.quantity)}, satuan ${pct(extract.metrics!.unit)}, kode/pesanan ${pct(extract.metrics!.order)}.` : "Belum dijalankan: dataset belum ada."}

## Suite yang dilewati

${skipped.length ? [...new Set(skipped)].join("\n") : "Tidak ada."}

Harga token dicek ${pricing.checkedAt} dari katalog AI Gateway (\`evals/pricing.json\`). Model tier gratis biayanya $0; kolom biaya di atas adalah perkiraan bila memakai ${pricing.comparison}.
`;

writeFileSync("evals/REPORT.md", report);
console.log(report);
