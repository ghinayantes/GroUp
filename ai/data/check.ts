import { existsSync, readdirSync } from "node:fs";
import { readJsonl } from "./rows";
import { TEST_SET_RULES, TRAIN_SOURCE_RULES, validateRows, type ValidationRules } from "./validate";

const RAW = "ai/data/raw";
const rawFiles = existsSync(RAW) ? readdirSync(RAW).filter((name) => name.endsWith(".jsonl")) : [];
const FILES: [string, ValidationRules][] = [
  ["ai/data/test.jsonl", TEST_SET_RULES],
  ...rawFiles.map((name): [string, ValidationRules] => [`${RAW}/${name}`, TRAIN_SOURCE_RULES]),
];

let failed = false;
for (const [path, rules] of FILES) {
  if (!existsSync(path)) {
    console.log(`${path}: belum ada`);
    if (rules === TEST_SET_RULES) failed = true;
    continue;
  }
  let rows: unknown[];
  try {
    rows = readJsonl(path);
  } catch (error) {
    console.log(`${path}: bukan JSONL valid (${error instanceof Error ? error.message : error})`);
    failed = true;
    continue;
  }
  const { errors, counts } = validateRows(rows, rules);
  console.log(`${path}: ${rows.length} baris`, counts);
  for (const error of errors) console.log(`  - ${error}`);
  failed ||= errors.length > 0;
}
process.exitCode = failed ? 1 : 0;
