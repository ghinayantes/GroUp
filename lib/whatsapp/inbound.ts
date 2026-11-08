import "server-only";
import type { InboundMessage } from "@/lib/agent/types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type Reply = { id?: string; title?: string };

type MetaMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  interactive?: { list_reply?: Reply; button_reply?: Reply };
};

type MetaValue = { messages?: MetaMessage[]; contacts?: { wa_id?: string; profile?: { name?: string } }[] };

export type ParsedInbound = { messageId: string; from: string; msg: InboundMessage };

const list = <T>(value: unknown): T[] => (Array.isArray(value) ? value : []);

function toInbound(message: MetaMessage & { id: string; from: string }, profileName: string | undefined): InboundMessage {
  const base = { channel: "whatsapp" as const, senderKey: message.from, messageId: message.id, ...(profileName ? { profileName } : {}) };
  if (message.type === "text") return { ...base, kind: "text", text: message.text?.body?.trim() ?? "" };
  const reply = message.type === "interactive" ? message.interactive?.list_reply ?? message.interactive?.button_reply : undefined;
  if (reply?.id) return { ...base, kind: "interactive", text: reply.title ?? "", replyId: reply.id };
  return { ...base, kind: "unsupported", text: "" };
}

export function parseWebhook(body: unknown): ParsedInbound[] {
  const parsed: ParsedInbound[] = [];
  const entries = body && typeof body === "object" ? list<{ changes?: unknown }>((body as { entry?: unknown }).entry) : [];
  for (const entry of entries) {
    for (const change of list<{ value?: MetaValue }>(entry?.changes)) {
      const value = change?.value;
      const contacts = list<NonNullable<MetaValue["contacts"]>[number]>(value?.contacts);
      for (const message of list<MetaMessage>(value?.messages)) {
        if (typeof message?.id !== "string" || typeof message.from !== "string" || !message.id || !message.from) continue;
        const contact = contacts.find((item) => item?.wa_id === message.from) ?? contacts[0];
        const msg = toInbound(message as MetaMessage & { id: string; from: string }, contact?.profile?.name);
        parsed.push({ messageId: message.id, from: message.from, msg });
      }
    }
  }
  return parsed;
}

export async function claimInbound(messageId: string, phone: string): Promise<boolean> {
  const { data, error } = await createSupabaseAdminClient()
    .from("inbound_messages")
    .upsert({ provider_message_id: messageId, phone }, { onConflict: "provider_message_id", ignoreDuplicates: true })
    .select("provider_message_id");
  if (error) throw new Error("Could not record inbound WhatsApp message.");
  return Boolean(data?.length);
}
