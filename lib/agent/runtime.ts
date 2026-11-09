import "server-only";
import { createMarketPricePort } from "./adapters/market-price";
import { createSupabaseDeps } from "./adapters/supabase";
import { createEngine } from "./engine";
import { createStage2FromEnv, type Env } from "./model-provider";
import type { EngineDeps } from "./ports";
import { loadIntentClassifier } from "./stage1/classifier";

const siteUrl = (env: Env) => env.NEXT_PUBLIC_SITE_URL || `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;

export async function createRuntimeDeps(env: Env = process.env): Promise<EngineDeps> {
  return {
    ...createSupabaseDeps(),
    classifier: await loadIntentClassifier(),
    stage2: createStage2FromEnv(env),
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
