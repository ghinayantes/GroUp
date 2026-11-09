import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Stage2Agent, Stage2Result } from "@/lib/agent/ports";

export type CachedAgent = Stage2Agent & { stats: { hits: number; misses: number } };

export function withCache(agent: Stage2Agent, { dir = "evals/cache", refresh = false, salt = "" }: { dir?: string; refresh?: boolean; salt?: string } = {}): CachedAgent {
  const stats = { hits: 0, misses: 0 };
  return {
    model: agent.model,
    stats,
    async propose(input, tools) {
      const key = createHash("sha256").update(agent.model).update(salt).update(JSON.stringify(input)).digest("hex");
      const file = path.join(dir, `${key}.json`);
      if (!refresh && existsSync(file)) {
        stats.hits += 1;
        return JSON.parse(readFileSync(file, "utf8")) as Stage2Result;
      }
      stats.misses += 1;
      const result = await agent.propose(input, tools);
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, JSON.stringify(result, null, 2) + "\n");
      return result;
    },
  };
}
