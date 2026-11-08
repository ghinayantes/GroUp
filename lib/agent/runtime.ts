import "server-only";
import { createSupabaseDeps } from "./adapters/supabase";
import { createEngine } from "./engine";

let engine: Promise<ReturnType<typeof createEngine>> | null = null;

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;

export function getEngine(): Promise<ReturnType<typeof createEngine>> {
  engine ??= Promise.resolve(
    createEngine({
      ...createSupabaseDeps(),
      classifier: null,
      stage2: null,
      agentEnabled: process.env.AGENT_ENABLED !== "false",
      siteUrl: siteUrl(),
      now: () => new Date(),
    }),
  );
  return engine;
}
