import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/test/fake-supabase";
import { claimInbound, parseWebhook } from "./inbound";

vi.mock("@/lib/supabase/server", async () => {
  const { fakeSupabase } = await import("@/test/fake-supabase");
  return { createSupabaseAdminClient: () => fakeSupabase.client };
});

const webhook = (messages: unknown[]) => ({
  object: "whatsapp_business_account",
  entry: [{ changes: [{ field: "messages", value: { contacts: [{ wa_id: "6281", profile: { name: "Sari" } }], messages } }] }],
});

beforeEach(() => fakeSupabase.reset());

describe("parseWebhook", () => {
  it("parseWebhook memetakan text, button_reply, list_reply, dan image→unsupported", () => {
    const parsed = parseWebhook(webhook([
      { id: "wamid.1", from: "6281", type: "text", text: { body: "  MULAI  " } },
      { id: "wamid.2", from: "6281", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "ORDER_CONFIRM", title: "Ya, ikut" } } },
      { id: "wamid.3", from: "6281", type: "interactive", interactive: { type: "list_reply", list_reply: { id: "batch-1", title: "Cabai", description: "x" } } },
      { id: "wamid.4", from: "6281", type: "image", image: { id: "media-1" } },
    ]));

    expect(parsed.map((p) => [p.messageId, p.from])).toEqual([
      ["wamid.1", "6281"], ["wamid.2", "6281"], ["wamid.3", "6281"], ["wamid.4", "6281"],
    ]);
    const base = { channel: "whatsapp", senderKey: "6281", profileName: "Sari" };
    expect(parsed[0].msg).toEqual({ ...base, messageId: "wamid.1", kind: "text", text: "MULAI" });
    expect(parsed[1].msg).toEqual({ ...base, messageId: "wamid.2", kind: "interactive", text: "Ya, ikut", replyId: "ORDER_CONFIRM" });
    expect(parsed[2].msg).toEqual({ ...base, messageId: "wamid.3", kind: "interactive", text: "Cabai", replyId: "batch-1" });
    expect(parsed[3].msg).toEqual({ ...base, messageId: "wamid.4", kind: "unsupported", text: "" });
  });

  it("mengabaikan status update, pesan tanpa id/from, dan body yang bukan objek", () => {
    expect(parseWebhook(null)).toEqual([]);
    expect(parseWebhook({ entry: "x" })).toEqual([]);
    expect(parseWebhook({ entry: [{ changes: [{ value: { statuses: [{ id: "wamid.9", status: "read" }] } }] }] })).toEqual([]);
    expect(parseWebhook(webhook([{ type: "text", text: { body: "hai" } }]))).toEqual([]);
  });

  it("interactive tanpa id reply dianggap unsupported", () => {
    const [parsed] = parseWebhook(webhook([{ id: "wamid.5", from: "6281", type: "interactive", interactive: { type: "nfm_reply" } }]));
    expect(parsed.msg.kind).toBe("unsupported");
  });
});

describe("claimInbound", () => {
  it("claimInbound kedua untuk messageId sama mengembalikan false", async () => {
    let seen = 0;
    fakeSupabase.respond(() => (seen++ === 0 ? { data: [{ provider_message_id: "wamid.1" }] } : { data: [] }));

    expect(await claimInbound("wamid.1", "6281")).toBe(true);
    expect(await claimInbound("wamid.1", "6281")).toBe(false);

    const [first] = fakeSupabase.calls;
    expect(first.table).toBe("inbound_messages");
    expect(fakeSupabase.op(first, "upsert")).toEqual([
      [{ provider_message_id: "wamid.1", phone: "6281" }, { onConflict: "provider_message_id", ignoreDuplicates: true }],
    ]);
  });

  it("melempar error kalau upsert gagal", async () => {
    fakeSupabase.respond(() => ({ error: { message: "down" } }));
    await expect(claimInbound("wamid.1", "6281")).rejects.toThrow();
  });
});
