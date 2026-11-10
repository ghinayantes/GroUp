import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { readEvalResults } from "@/evals/summary";
import { evalHighlights, type EvalHighlights } from "@/lib/showcase";

const TEST_FILE = path.join(process.cwd(), "ai", "data", "test.jsonl");

export function loadEvalHighlights(): EvalHighlights | null {
  try {
    const testRows = existsSync(TEST_FILE) ? readFileSync(TEST_FILE, "utf8").split("\n").filter((line) => line.trim()).length : 0;
    return evalHighlights(readEvalResults(), testRows);
  } catch {
    return null;
  }
}
