import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { loadIntentClassifier } from "@/lib/agent/stage1/classifier";
import { createHash } from "node:crypto";
import { createStage2Agent, type Stage2OutputMode } from "@/lib/agent/stage2/agent";
import { STAGE2_JSON_FORMAT, STAGE2_SYSTEM } from "@/lib/agent/stage2/prompt";
import { withCache, type CachedAgent } from "./cache";
import { loadExtract, loadIntentTest, loadScenarios, type Loaded } from "./datasets";
import { runIntentSuite, runScenarioSuite, scoreExtract } from "./suites";

const SUITES = ["intent", "extract", "e2e", "safety", "grounding"] as const;
const MODES = ["fixed-only", "llm-only", "router"] as const;
type Suite = (typeof SUITES)[number];
type Mode = (typeof MODES)[number];

const { values } = parseArgs({
  options: { suite: { type: "string", default: "all" }, mode: { type: "string", default: "router" }, refresh: { type: "boolean", default: false } },
});
const mode = values.mode as Mode;
if (!MODES.includes(mode)) throw new Error(`--mode harus salah satu dari ${MODES.join(", ")}`);
const suites: Suite[] = values.suite === "all" ? [...SUITES] : [values.suite as Suite];
if (!suites.every((s) => SUITES.includes(s))) throw new Error(`--suite harus all atau salah satu dari ${SUITES.join(", ")}`);

const model = process.env.AGENT_STAGE2_MODEL ?? "nvidia/nemotron-3.5-lightning-free";
const outputMode = (process.env.AGENT_STAGE2_OUTPUT_MODE ?? "json-text") as Stage2OutputMode;
const classifier = mode === "router" ? await loadIntentClassifier() : null;
const stage2: CachedAgent | null = mode === "fixed-only" ? null : withCache(createStage2Agent({ model, outputMode }), {
        refresh: values.refresh,
        salt: `${outputMode}:${createHash("sha256").update(STAGE2_SYSTEM + STAGE2_JSON_FORMAT).digest("hex")}`,
      });
const credentials = Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);

let commit = "unknown";
try {
  commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
} catch {}

const date = new Date().toISOString().slice(0, 10);
const dataset = <T>(loaded: Loaded<T>) => ({ path: loaded.path, rows: loaded.rows.length, missing: loaded.missing });

async function runSuite(suite: Suite) {
  const meta = { suite, mode, date, commit, stage2Model: stage2 ? model : null, outputMode: stage2 ? outputMode : null, classifierVersion: classifier?.version ?? null };
  if (suite === "intent") {
    const data = loadIntentTest();
    if (data.missing) return { ...meta, status: "skipped", reason: `${data.path} belum ada`, dataset: dataset(data) };
    if (mode !== "router") return { ...meta, status: "skipped", reason: "suite intent mengukur classifier tahap 1; jalankan dengan --mode router", dataset: dataset(data) };
    if (!classifier) return { ...meta, status: "skipped", reason: "models/intent-classifier belum ada atau gagal dimuat", dataset: dataset(data) };
    return { ...meta, status: "ok", dataset: dataset(data), metrics: await runIntentSuite(data.rows, classifier) };
  }
  if (suite === "extract") {
    const data = loadExtract();
    if (data.missing) return { ...meta, status: "skipped", reason: `${data.path} belum ada`, dataset: dataset(data) };
    return { ...meta, status: "ok", dataset: dataset(data), metrics: scoreExtract(data.rows) };
  }
  const sets = suite === "grounding" ? (["e2e", "safety"] as const) : ([suite] as const);
  const loaded = sets.map((set) => loadScenarios(set));
  const rows = loaded.flatMap((data) => data.rows);
  const datasets = loaded.map(dataset);
  if (!rows.length) return { ...meta, status: "skipped", reason: `${loaded.map((d) => d.path).join(" dan ")} belum ada atau kosong`, datasets };
  const before = stage2 ? { ...stage2.stats } : null;
  const metrics = await runScenarioSuite(rows, { classifier, stage2 });
  const cache = stage2 && before ? { hits: stage2.stats.hits - before.hits, misses: stage2.stats.misses - before.misses, credentials } : null;
  return { ...meta, status: "ok", datasets, cache, metrics: suite === "grounding" ? { grounding: metrics.grounding, efficiency: metrics.efficiency } : metrics };
}

mkdirSync("evals/results", { recursive: true });
for (const suite of suites) {
  const result = await runSuite(suite);
  const file = `evals/results/${date}-${suite}-${mode}.json`;
  writeFileSync(file, JSON.stringify(result, null, 2) + "\n");
  console.log(`${suite} (${mode}): ${result.status}${"reason" in result ? ` — ${result.reason}` : ""} → ${file}`);
}
if (stage2 && !credentials && stage2.stats.misses > 0) {
  console.warn(`Peringatan: ${stage2.stats.misses} panggilan tahap 2 tanpa AI_GATEWAY_API_KEY/VERCEL_OIDC_TOKEN; hasilnya fallback menu.`);
}
