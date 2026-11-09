import "server-only";
import { createMarketPricePort } from "./adapters/market-price";
import { createSupabaseDeps } from "./adapters/supabase";
import { createEngine } from "./engine";
import type { EngineDeps } from "./ports";
import { loadIntentClassifier } from "./stage1/classifier";
import { createStage2Agent, type Stage2OutputMode } from "./stage2/agent";

type Env = Record<string, string | undefined>;

const DEFAULT_STAGE2_MODEL = "nvidia/nemotron-3.5-lightning-free";
const DEFAULT_OUTPUT_MODE: Stage2OutputMode = "json-text";
const OUTPUT_MODES: readonly Stage2OutputMode[] = ["native", "json-text"];

function outputMode(value: string | undefined): Stage2OutputMode {
  if (!value) return DEFAULT_OUTPUT_MODE;
  if ((OUTPUT_MODES as readonly string[]).includes(value)) return value as Stage2OutputMode;
  console.warn(`AGENT_STAGE2_OUTPUT_MODE "${value}" tidak dikenal; memakai ${DEFAULT_OUTPUT_MODE}.`);
  return DEFAULT_OUTPUT_MODE;
}

const siteUrl = (env: Env) => env.NEXT_PUBLIC_SITE_URL || `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;

export async function createRuntimeDeps(env: Env = process.env): Promise<EngineDeps> {
  return {
    ...createSupabaseDeps(),
    classifier: await loadIntentClassifier(),
    stage2: createStage2Agent({
      model: env.AGENT_STAGE2_MODEL || DEFAULT_STAGE2_MODEL,
      outputMode: outputMode(env.AGENT_STAGE2_OUTPUT_MODE),
    }),
    marketPrice: createMarketPricePort(),
    agentEnabled: env.AGENT_ENABLED !== "false",
    siteUrl: siteUrl(env),
    now: () => new Date(),
  };
}

let engine: Promise<ReturnType<typeof createEngine>> | null = null;

export function getEngine(): Promise<ReturnType<typeof createEngine>> {
  engine ??= createRuntimeDeps()
    .then(createEngine)
    .catch((error) => {
      engine = null;
      throw error;
    });
  return engine;
}
