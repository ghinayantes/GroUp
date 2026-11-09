import { existsSync, readdirSync } from "node:fs";
import { INTENTS } from "@/lib/agent/types";
import { augment, mulberry32 } from "./augment";
import { readJsonl, writeJsonl, type IntentRow } from "./rows";
import { dedupeAgainst, stratifiedSplit } from "./split";
import { TEST_SET_RULES, TRAIN_SOURCE_RULES, validateRows } from "./validate";

const DIR = "ai/data";
const SEED = 42;
const MAX_VAL_SIZE = 300;
const VAL_RATIO = 0.2;

function load(path: string, required: boolean): IntentRow[] {
  if (!existsSync(path)) {
    if (required) throw new Error(`${path} belum ada.`);
    console.warn(`${path} belum ada; dilewati.`);
    return [];
  }
  return readJsonl<IntentRow>(path);
}

function assertValid(name: string, rows: IntentRow[], rules: typeof TEST_SET_RULES) {
  const { errors } = validateRows(rows, rules);
  if (errors.length) throw new Error(`${name} tidak valid:\n- ${errors.join("\n- ")}`);
}

const test = load(`${DIR}/test.jsonl`, true);
assertValid("test.jsonl", test, TEST_SET_RULES);
const rawFiles = existsSync(`${DIR}/raw`) ? readdirSync(`${DIR}/raw`).filter((name) => name.endsWith(".jsonl")) : [];
if (!rawFiles.length) throw new Error(`${DIR}/raw/*.jsonl belum ada.`);
const pool = rawFiles.flatMap((name) => load(`${DIR}/raw/${name}`, true));
assertValid("raw/*.jsonl", pool, TRAIN_SOURCE_RULES);

const clean = dedupeAgainst(pool, test);
const rng = mulberry32(SEED);
const { train, val } = stratifiedSplit(clean, Math.min(MAX_VAL_SIZE, Math.round(clean.length * VAL_RATIO)), rng);
const augmented = train.flatMap((row) => [row, ...augment(row.text, rng).map((text) => ({ ...row, text }))]);

writeJsonl(`${DIR}/train.jsonl`, augmented);
writeJsonl(`${DIR}/val.jsonl`, val);

console.log(`Dibuang karena mirip test: ${pool.length - clean.length}`);
console.table(
  Object.fromEntries(
    INTENTS.map((intent) => [
      intent,
      {
        train: augmented.filter((row) => row.intent === intent).length,
        val: val.filter((row) => row.intent === intent).length,
        test: test.filter((row) => row.intent === intent).length,
      },
    ]),
  ),
);
console.log(`Total train ${augmented.length}, val ${val.length}, test ${test.length}`);
