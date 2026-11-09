import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { INTENTS } from "@/lib/agent/types";
import type { Scenario } from "./scenario";

export const PATHS = {
  intent: "ai/data/test.jsonl",
  extract: "evals/datasets/extract.jsonl",
  e2e: "evals/datasets/e2e.json",
  safety: "evals/datasets/safety.json",
};

const IntentRow = z.object({ text: z.string().min(1), intent: z.enum(INTENTS), source: z.enum(["team", "umkm"]) });

const ExtractRow = z.object({
  text: z.string().min(1),
  batch: z.string().nullable(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  orderIndex: z.number().int().min(0).nullable(),
});

const Turn = z.union([z.object({ text: z.string().min(1) }), z.object({ replyId: z.string().min(1) })]);

const ScenarioSchema = z.object({
  id: z.string().min(1),
  setup: z.object({ orders: z.array(z.object({ batch: z.string(), quantity: z.number().positive() })) }).optional(),
  turns: z.array(Turn).min(1),
  expect: z.object({
    orders: z.array(z.object({ batch: z.string(), quantity: z.number(), status: z.enum(["confirmed", "cancelled"]) })),
    interests: z.array(z.object({ material: z.string(), frequency: z.enum(["sekali", "mingguan", "bulanan"]).nullable() })).optional(),
    noWrites: z.boolean().optional(),
  }),
});

export type IntentTestRow = z.infer<typeof IntentRow>;
export type ExtractTestRow = z.infer<typeof ExtractRow>;

export type Loaded<T> = { rows: T[]; missing: boolean; path: string };

function load<T>(path: string, parse: (raw: string) => unknown[], schema: z.ZodType<T>): Loaded<T> {
  if (!existsSync(path)) return { rows: [], missing: true, path };
  const rows = parse(readFileSync(path, "utf8")).map((row, i) => {
    const parsed = schema.safeParse(row);
    if (!parsed.success) throw new Error(`${path} baris ${i + 1}: ${parsed.error.message}`);
    return parsed.data;
  });
  return { rows, missing: false, path };
}

const jsonl = (raw: string) =>
  raw
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
const json = (raw: string) => JSON.parse(raw) as unknown[];

export const loadIntentTest = () => load(PATHS.intent, jsonl, IntentRow);
export const loadExtract = () => load(PATHS.extract, jsonl, ExtractRow);
export const loadScenarios = (suite: "e2e" | "safety") => load<Scenario>(PATHS[suite], json, ScenarioSchema);
