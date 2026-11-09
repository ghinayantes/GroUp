import "server-only";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { IntentClassifier, IntentScore } from "../ports";
import { INTENTS, type Intent } from "../types";

type ThresholdsFile = { modelVersion: string; baseModel: string; thresholds: Partial<Record<Intent, number>> };

export type IntentScorer = (text: string) => Promise<IntentScore>;

export const DEFAULT_MODEL_DIR = path.join(process.cwd(), "models", "intent-classifier");

const NEVER_ACCEPT = 1.01;
const MODEL_FILE = path.join("onnx", "model_quantized.onnx");

const cache = new Map<string, Promise<IntentClassifier | null>>();

const isIntent = (label: unknown): label is Intent => INTENTS.includes(label as Intent);

export async function loadIntentScorer(dir = DEFAULT_MODEL_DIR): Promise<IntentScorer> {
  if (!existsSync(path.join(dir, MODEL_FILE))) throw new Error(`${path.join(dir, MODEL_FILE)} not found`);
  const config = JSON.parse(await readFile(path.join(dir, "config.json"), "utf8")) as { id2label?: Record<string, unknown> };
  const labels = Object.values(config.id2label ?? {});
  if (!labels.length || !labels.every(isIntent)) throw new Error(`Model labels in ${dir} are not all in INTENTS`);

  const { env, pipeline } = await import("@huggingface/transformers");
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = path.dirname(dir) + path.sep;
  const classify = await pipeline("text-classification", path.basename(dir), { dtype: "q8" });
  return async (text) => {
    const [top] = (await classify(text)) as { label: string; score: number }[];
    if (!isIntent(top.label)) throw new Error(`Unknown label ${top.label}`);
    return { intent: top.label, confidence: top.score };
  };
}

async function create(dir: string): Promise<IntentClassifier | null> {
  const thresholdsPath = path.join(dir, "thresholds.json");
  if (!existsSync(thresholdsPath)) {
    console.warn(`Intent classifier thresholds not found in ${dir}; free text goes to stage 2.`);
    return null;
  }
  try {
    const { modelVersion, thresholds } = JSON.parse(await readFile(thresholdsPath, "utf8")) as ThresholdsFile;
    const classify = await loadIntentScorer(dir);
    return {
      version: modelVersion,
      classify,
      accepts: (score) => score.confidence >= (thresholds[score.intent] ?? NEVER_ACCEPT),
    };
  } catch (error) {
    console.warn(`Intent classifier in ${dir} could not be loaded; free text goes to stage 2.`, error);
    return null;
  }
}

export function loadIntentClassifier(dir = DEFAULT_MODEL_DIR): Promise<IntentClassifier | null> {
  let classifier = cache.get(dir);
  if (!classifier) {
    classifier = create(dir);
    cache.set(dir, classifier);
  }
  return classifier;
}
