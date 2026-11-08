import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDeps, type MemoryDeps } from "@/lib/agent/adapters/memory";
import { createEngine } from "@/lib/agent/engine";
import { BUTTON, type Reply } from "@/lib/agent/types";
import { FIXTURE_BATCHES, FIXTURE_NOW } from "@/test/fixtures/batches";

const hoisted = vi.hoisted(() => ({ engine: null as unknown }));

vi.mock("@/lib/agent/runtime", () => ({ getEngine: async () => hoisted.engine }));

const { POST } = await import("./route");

const SENDER = /^sim-[0-9a-f]{16}$/;

let deps: MemoryDeps;

const post = (body: unknown, cookie?: string) =>
  POST(new NextRequest("http://localhost/api/simulator/message", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie: `sim_session=${cookie}` } : {}) },
  }));

beforeEach(() => {
  deps = createMemoryDeps({ batches: FIXTURE_BATCHES.map((b) => ({ ...b, tiers: [...b.tiers] })), now: FIXTURE_NOW });
  hoisted.engine = createEngine(deps);
});

describe("POST /api/simulator/message", () => {
  it("tanpa cookie membuat sim_session dan memakai senderKey sim-…", async () => {
    const response = await post({ text: "MULAI" });

    expect(response.status).toBe(200);
    const cookie = response.cookies.get("sim_session");
    expect(cookie?.value).toMatch(SENDER);
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 });
    expect(deps.state.history.has(`simulator:${cookie!.value}`)).toBe(true);
  });

  it("cookie yang sudah valid dipakai ulang tanpa diganti", async () => {
    const response = await post({ text: "MULAI" }, "sim-0123456789abcdef");

    expect(response.status).toBe(200);
    expect(response.cookies.get("sim_session")).toBeUndefined();
    expect(deps.state.history.has("simulator:sim-0123456789abcdef")).toBe(true);
  });

  it("body kosong 400", async () => {
    const response = await post({});

    expect(response.status).toBe(400);
    expect(deps.state.history.size).toBe(0);
  });

  it("text 1001 karakter 400", async () => {
    const response = await post({ text: "a".repeat(1001) });

    expect(response.status).toBe(400);
    expect(deps.state.history.size).toBe(0);
  });

  it("alur MULAI → list reply → 3 → ORDER_CONFIRM membuat pesanan kanal simulator", async () => {
    const first = await post({ text: "MULAI" });
    const sender = first.cookies.get("sim_session")!.value;
    const start = (await first.json()) as { replies: Reply[]; trace: { stage: string } };
    expect(start.trace.stage).toBe("fixed");
    const list = start.replies.find((reply) => reply.kind === "list");
    expect(list?.kind).toBe("list");
    const row = list!.kind === "list" ? list!.rows[0] : null;

    const picked = await post({ replyId: row!.id, replyTitle: row!.title }, sender);
    expect(picked.status).toBe(200);
    const quantity = await post({ text: "3" }, sender);
    const confirm = (await quantity.json()) as { replies: Reply[] };
    expect(confirm.replies.some((reply) => reply.kind === "buttons" && reply.buttons.some((b) => b.id === BUTTON.ORDER_CONFIRM))).toBe(true);

    const done = await post({ replyId: BUTTON.ORDER_CONFIRM, replyTitle: "Ya, ikut" }, sender);
    expect(done.status).toBe(200);
    expect(deps.state.orders).toHaveLength(1);
    expect(deps.state.orders[0]).toMatchObject({ channel: "simulator", senderKey: sender, batchId: row!.id, quantity: 3, customerName: "Pengunjung simulator" });
  });
});
