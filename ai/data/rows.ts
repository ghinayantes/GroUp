import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Intent } from "@/lib/agent/types";

export const SOURCES = ["synthetic", "team", "umkm"] as const;

export type IntentRow = { text: string; intent: Intent; source: (typeof SOURCES)[number] };

export function readJsonl<T>(path: string): T[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as T);
}

export function writeJsonl(path: string, rows: unknown[]) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
}
