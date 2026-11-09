import "server-only";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { createMarketPricePort } from "./adapters/market-price";
import { createSupabaseDeps } from "./adapters/supabase";
import { createEngine } from "./engine";
import type { EngineDeps, Stage2Agent } from "./ports";
import { loadIntentClassifier } from "./stage1/classifier";
import { createStage2Agent, type Stage2OutputMode } from "./stage2/agent";

type Env = Record<string, string | undefined>;

const DEFAULT_GATEWAY_MODEL = "nvidia/nemotron-3.5-lightning-free";
const DEFAULT_GOOGLE_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_OUTPUT_MODE: Stage2OutputMode = "json-text";

type Stage2Model = { label: string; languageModel?: LanguageModel };

const disabled = (reason: string) => {
  console.warn(`Tahap 2 dimatikan: ${reason}. Teks bebas dibalas menu.`);
  return null;
};

function stage2Model(env: Env): Stage2Model | null {
  const provider = env.AGENT_STAGE2_PROVIDER || "gateway";
  const model = env.AGENT_STAGE2_MODEL;

  switch (provider) {
    case "gateway":
      return { label: model || DEFAULT_GATEWAY_MODEL };
    case "google": {
      if (!env.GOOGLE_GENERATIVE_AI_API_KEY) return disabled("GOOGLE_GENERATIVE_AI_API_KEY belum diisi");
      const id = model || DEFAULT_GOOGLE_MODEL;
      return { label: `google/${id}`, languageModel: createGoogle({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY })(id) };
    }
    case "openai-compatible": {
      const missing = ["AGENT_STAGE2_BASE_URL", "AGENT_STAGE2_API_KEY", "AGENT_STAGE2_MODEL"].filter((name) => !env[name]);
      if (missing.length) return disabled(`${missing.join(", ")} belum diisi`);
      const compatible = createOpenAICompatible({
        name: "openai-compatible",
        baseURL: env.AGENT_STAGE2_BASE_URL!,
        apiKey: env.AGENT_STAGE2_API_KEY,
        supportsStructuredOutputs: true,
      });
      return { label: `openai-compatible/${model}`, languageModel: compatible(model!) };
    }
    default:
      return disabled(`AGENT_STAGE2_PROVIDER "${provider}" tidak dikenal (gateway, google, openai-compatible)`);
  }
}

function createStage2(env: Env): Stage2Agent | null {
  const selected = stage2Model(env);
  if (!selected) return null;
  return createStage2Agent({
    model: selected.label,
    languageModel: selected.languageModel,
    outputMode: outputMode(env.AGENT_STAGE2_OUTPUT_MODE),
  });
}
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
    stage2: createStage2(env),
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
