import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { Stage2Agent, Stage2Input, ToolContext } from "@/lib/agent/ports";
import { FIXTURE_BATCHES } from "@/test/fixtures/batches";
import { withCache } from "./cache";

const dir = mkdtempSync(path.join(tmpdir(), "eval-cache-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const input: Stage2Input = { text: "kapan bayarnya", stage1: null, sessionStage: null, batches: FIXTURE_BATCHES, orders: [], history: [] };
const tools = {} as ToolContext;

function fakeAgent(): Stage2Agent & { propose: ReturnType<typeof vi.fn> } {
  return {
    model: "test/model",
    propose: vi.fn(async () => ({ action: { type: "answer" as const, text: "Setelah kuota." }, model: "test/model", inputTokens: 10, outputTokens: 5, toolNames: ["detail_batch"], toolOutputs: [{ a: 1 }] })),
  };
}

describe("withCache", () => {
  it("panggilan kedua dengan input sama dibaca dari file", async () => {
    const inner = fakeAgent();
    const cached = withCache(inner, { dir });
    const first = await cached.propose(input, tools);
    const second = await cached.propose(input, tools);
    expect(second).toEqual(first);
    expect(inner.propose).toHaveBeenCalledOnce();
    expect(readdirSync(dir).filter((f) => f.endsWith(".json"))).toHaveLength(1);
  });

  it("input atau batch berbeda → panggilan baru", async () => {
    const inner = fakeAgent();
    const cached = withCache(inner, { dir: path.join(dir, "beda") });
    await cached.propose(input, tools);
    await cached.propose({ ...input, text: "lain" }, tools);
    await cached.propose({ ...input, batches: FIXTURE_BATCHES.slice(1) }, tools);
    expect(inner.propose).toHaveBeenCalledTimes(3);
  });

  it("refresh memaksa panggilan ulang dan menimpa file", async () => {
    const inner = fakeAgent();
    const target = path.join(dir, "refresh");
    await withCache(inner, { dir: target }).propose(input, tools);
    await withCache(inner, { dir: target, refresh: true }).propose(input, tools);
    expect(inner.propose).toHaveBeenCalledTimes(2);
    expect(existsSync(target)).toBe(true);
  });

  it("menghitung hit dan miss", async () => {
    const cached = withCache(fakeAgent(), { dir: path.join(dir, "stats") });
    await cached.propose(input, tools);
    await cached.propose(input, tools);
    expect(cached.stats).toEqual({ hits: 1, misses: 1 });
  });
});
