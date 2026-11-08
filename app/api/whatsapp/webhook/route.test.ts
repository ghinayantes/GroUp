import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDeps, type MemoryDeps } from "@/lib/agent/adapters/memory";
import { notTextReply } from "@/lib/agent/copy";
import { createEngine } from "@/lib/agent/engine";
import { BUTTON } from "@/lib/agent/types";
import { fakeSupabase } from "@/test/fake-supabase";
import { FIXTURE_BATCHES, FIXTURE_NOW } from "@/test/fixtures/batches";

const hoisted = vi.hoisted(() => ({
  pending: [] as (() => Promise<void>)[],
  engine: null as unknown,
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => {
    hoisted.pending.push(task);
  },
}));
vi.mock("@/lib/supabase/server", async () => {
  const { fakeSupabase } = await import("@/test/fake-supabase");
  return { createSupabaseAdminClient: () => fakeSupabase.client };
});
vi.mock("@/lib/agent/runtime", () => ({ getEngine: async () => hoisted.engine }));
vi.mock("@/lib/whatsapp/client", () => ({ sendReplies: vi.fn(async () => {}) }));

const { POST } = await import("./route");
const { sendReplies } = await import("@/lib/whatsapp/client");

const SECRET = "test-app-secret";
const PHONE = "6281234";

let deps: MemoryDeps;

const runAfter = async () => {
  const tasks = hoisted.pending.splice(0);
  for (const task of tasks) await task();
};

const signed = (payload: unknown, signature?: string) => {
  const raw = JSON.stringify(payload);
  const sig = signature ?? `sha256=${createHmac("sha256", SECRET).update(raw).digest("hex")}`;
  return new Request("http://localhost/api/whatsapp/webhook", { method: "POST", body: raw, headers: { "x-hub-signature-256": sig } });
};

const delivery = (...messages: Record<string, unknown>[]) => ({
  entry: [{ changes: [{ value: { contacts: [{ wa_id: PHONE, profile: { name: "Sari" } }], messages: messages.map((m) => ({ from: PHONE, ...m })) } }] }],
});

beforeEach(() => {
  process.env.WHATSAPP_APP_SECRET = SECRET;
  process.env.WHATSAPP_VERIFY_TOKEN = "verify";
  hoisted.pending.length = 0;
  vi.mocked(sendReplies).mockClear();
  fakeSupabase.reset();
  const claimed = new Set<string>();
  fakeSupabase.respond((call) => {
    const [row] = fakeSupabase.op(call, "upsert")[0] as [{ provider_message_id: string }];
    if (claimed.has(row.provider_message_id)) return { data: [] };
    claimed.add(row.provider_message_id);
    return { data: [{ provider_message_id: row.provider_message_id }] };
  });
  deps = createMemoryDeps({ batches: FIXTURE_BATCHES.map((b) => ({ ...b, tiers: [...b.tiers] })), now: FIXTURE_NOW });
  hoisted.engine = createEngine(deps);
});

describe("POST /api/whatsapp/webhook", () => {
  it("menolak signature salah tanpa menjadwalkan pekerjaan", async () => {
    const response = await POST(signed(delivery({ id: "wamid.x", type: "text", text: { body: "MULAI" } }), "sha256=00"));

    expect(response.status).toBe(401);
    expect(hoisted.pending).toHaveLength(0);
  });

  it("membalas 200 sebelum engine berjalan, lalu mengirim balasan di after()", async () => {
    const response = await POST(signed(delivery({ id: "wamid.1", type: "text", text: { body: "MULAI" } })));

    expect(response.status).toBe(200);
    expect(sendReplies).not.toHaveBeenCalled();
    await runAfter();
    expect(sendReplies).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendReplies).mock.calls[0][0]).toBe(PHONE);
    expect(vi.mocked(sendReplies).mock.calls[0][1][0].kind).toBe("list");
  });

  it("pengiriman ulang Meta untuk ORDER_CONFIRM menghasilkan satu set balasan dan satu pesanan (fokus review #3)", async () => {
    await deps.sessions.save({
      channel: "whatsapp", senderKey: PHONE, stage: "confirm_order", batchId: FIXTURE_BATCHES[0].id, quantity: 5,
      customerName: "Sari", pendingAction: null, expiresAt: new Date(FIXTURE_NOW.getTime() + 60_000).toISOString(),
    });
    const tap = delivery({ id: "wamid.confirm", type: "interactive", interactive: { type: "button_reply", button_reply: { id: BUTTON.ORDER_CONFIRM, title: "Ya, ikut" } } });

    expect((await POST(signed(tap))).status).toBe(200);
    expect((await POST(signed(tap))).status).toBe(200);
    await runAfter();

    expect(sendReplies).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendReplies).mock.calls[0][1][0].body).toContain("Pesananmu tercatat");
    expect(deps.state.orders).toHaveLength(1);
  });

  it("stiker membalas notTextReply", async () => {
    await POST(signed(delivery({ id: "wamid.s", type: "sticker", sticker: { id: "m1" } })));
    await runAfter();

    expect(sendReplies).toHaveBeenCalledWith(PHONE, [notTextReply()]);
  });

  it("error di dalam after() dicatat dan pesan berikutnya tetap diproses", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(sendReplies).mockRejectedValueOnce(new Error("graph down"));
    const payload = delivery(
      { id: "wamid.a", type: "text", text: { body: "MULAI" } },
      { id: "wamid.b", type: "text", text: { body: "PESANAN" } },
    );

    await POST(signed(payload));
    await runAfter();

    expect(error).toHaveBeenCalled();
    expect(sendReplies).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it("body bukan JSON dibalas 400", async () => {
    const raw = "not json";
    const sig = `sha256=${createHmac("sha256", SECRET).update(raw).digest("hex")}`;
    const response = await POST(new Request("http://localhost/api/whatsapp/webhook", { method: "POST", body: raw, headers: { "x-hub-signature-256": sig } }));

    expect(response.status).toBe(400);
    expect(hoisted.pending).toHaveLength(0);
  });
});
