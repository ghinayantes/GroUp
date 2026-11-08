import "server-only";
import { BATCH_LIST_SECTION_TITLE } from "@/lib/agent/copy";
import type { Reply } from "@/lib/agent/types";

function getConfig() {
  const version = process.env.WHATSAPP_API_VERSION;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!version || !/^v\d+\.\d+$/.test(version) || !token || !phoneNumberId) {
    throw new Error("WhatsApp Cloud API belum dikonfigurasi.");
  }
  return { version, token, phoneNumberId };
}

async function send(to: string, message: Record<string, unknown>) {
  const { version, token, phoneNumberId } = getConfig();
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...message }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`WhatsApp API returned ${response.status}.`);
}

function toMessage(reply: Reply): Record<string, unknown> {
  if (reply.kind === "text") return { type: "text", text: { body: reply.body } };
  if (reply.kind === "list") {
    const rows = reply.rows.slice(0, 10).map((row) => ({
      id: row.id,
      title: row.title.slice(0, 24),
      description: row.description.slice(0, 72),
    }));
    return {
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: reply.body },
        action: { button: reply.button, sections: [{ title: BATCH_LIST_SECTION_TITLE, rows }] },
      },
    };
  }
  return {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: reply.body },
      action: {
        buttons: reply.buttons.slice(0, 3).map((button) => ({
          type: "reply",
          reply: { id: button.id, title: button.title.slice(0, 20) },
        })),
      },
    },
  };
}

export async function sendReplies(to: string, replies: Reply[]) {
  for (const reply of replies) await send(to, toMessage(reply));
}
