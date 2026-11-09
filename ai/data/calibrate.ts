import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_MODEL_DIR, loadIntentScorer } from "@/lib/agent/stage1/classifier";
import { INTENTS } from "@/lib/agent/types";
import { calibrate } from "./calibration";
import { readJsonl, type IntentRow } from "./rows";

const VAL = "ai/data/val.jsonl";
const pct = (value: number | null) => (value === null ? "-" : `${(value * 100).toFixed(1)}%`);

const score = await loadIntentScorer(DEFAULT_MODEL_DIR);
const rows = readJsonl<IntentRow>(VAL);
const scored = [];
for (const row of rows) {
  const { intent, confidence } = await score(row.text);
  scored.push({ predicted: intent, gold: row.intent, confidence });
}

const calibration = calibrate(scored);
const onnx = readFileSync(path.join(DEFAULT_MODEL_DIR, "onnx", "model_quantized.onnx"));
const summaryPath = path.join(DEFAULT_MODEL_DIR, "training_summary.json");
const baseModel = existsSync(summaryPath) ? (JSON.parse(readFileSync(summaryPath, "utf8")) as { chosen: string }).chosen : "unknown";
const thresholds = Object.fromEntries(INTENTS.map((intent) => [intent, calibration[intent].threshold]));
const output = {
  modelVersion: `${new Date().toISOString().slice(0, 10)}-${createHash("sha256").update(onnx).digest("hex").slice(0, 8)}`,
  baseModel,
  thresholds,
  calibration: { valRows: rows.length, targetPrecision: 0.97, minSupport: 5, confidenceLevel: 0.95, perIntent: calibration },
};
writeFileSync(path.join(DEFAULT_MODEL_DIR, "thresholds.json"), JSON.stringify(output, null, 2) + "\n");

console.log(`Val: ${rows.length} baris, model ${output.modelVersion} (${baseModel})`);
console.table(
  Object.fromEntries(
    INTENTS.map((intent) => {
      const c = calibration[intent];
      return [
        intent,
        {
          ambang: c.threshold,
          prediksi_val: c.valPredictions,
          diterima: c.support,
          presisi: pct(c.precision),
          wilson_95: c.precision === null ? "-" : `${pct(c.wilsonLow)}–${pct(c.wilsonHigh)}`,
        },
      ];
    }),
  ),
);
console.log("Catatan: batas bawah Wilson di bawah 97% berarti presisi ≥97% belum terbukti pada ukuran val ini.");
