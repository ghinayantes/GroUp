import { createGoogle } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import type { Stage2Agent } from "./ports";
import { createStage2Agent, type Stage2OutputMode } from "./stage2/agent";

export type Env = Record<string, string | undefined>;

export const PROVIDERS = ["gateway", "google", "openai-compatible"] as const;
export type Provider = (typeof PROVIDERS)[number];

const DEFAULT_GATEWAY_MODEL = "nvidia/nemotron-3.5-lightning-free";
const DEFAULT_GOOGLE_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_OUTPUT_MODE: Stage2OutputMode = "json-text";
const OUTPUT_MODES: readonly Stage2OutputMode[] = ["native", "json-text"];

export type SelectedModel = { provider: Provider; label: string; model: LanguageModel };

const disabled = (reason: string) => {
  console.warn(`Tahap 2 dimatikan: ${reason}. Teks bebas dibalas menu.`);
  return null;
};

export function stage2OutputMode(env: Env): Stage2OutputMode {
  const value = env.AGENT_STAGE2_OUTPUT_MODE;
  if (!value) return DEFAULT_OUTPUT_MODE;
  if ((OUTPUT_MODES as readonly string[]).includes(value)) return value as Stage2OutputMode;
  console.warn(`AGENT_STAGE2_OUTPUT_MODE "${value}" tidak dikenal; memakai ${DEFAULT_OUTPUT_MODE}.`);
  return DEFAULT_OUTPUT_MODE;
}

export function selectStage2Model(env: Env): SelectedModel | null {
  const provider = env.AGENT_STAGE2_PROVIDER || "gateway";
  const id = env.AGENT_STAGE2_MODEL;

  switch (provider) {
    case "gateway": {
      const label = id || DEFAULT_GATEWAY_MODEL;
      return { provider, label, model: label };
    }
    case "google": {
      if (!env.GOOGLE_GENERATIVE_AI_API_KEY) return disabled("GOOGLE_GENERATIVE_AI_API_KEY belum diisi");
      const modelId = id || DEFAULT_GOOGLE_MODEL;
      return { provider, label: `google/${modelId}`, model: createGoogle({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY })(modelId) };
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
      return { provider, label: `openai-compatible/${id}`, model: compatible(id!) };
    }
    default:
      return disabled(`AGENT_STAGE2_PROVIDER "${provider}" tidak dikenal (${PROVIDERS.join(", ")})`);
  }
}

export function createStage2FromEnv(env: Env): Stage2Agent | null {
  const selected = selectStage2Model(env);
  if (!selected) return null;
  return createStage2Agent({
    model: selected.label,
    languageModel: typeof selected.model === "string" ? undefined : selected.model,
    outputMode: stage2OutputMode(env),
  });
}
