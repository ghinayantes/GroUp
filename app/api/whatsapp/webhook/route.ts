import { NextResponse, after } from "next/server";
import { getEngine } from "@/lib/agent/runtime";
import { sendReplies } from "@/lib/whatsapp/client";
import { claimInbound, parseWebhook, type ParsedInbound } from "@/lib/whatsapp/inbound";
import { hasWhatsAppWebhookConfig, verifyWhatsAppSignature } from "@/lib/whatsapp/signature";

export async function GET(request: Request) {
  if (!hasWhatsAppWebhookConfig()) return new Response("WhatsApp belum dikonfigurasi.", { status: 503 });
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Webhook verification failed.", { status: 403 });
}

export async function POST(request: Request) {
  if (!hasWhatsAppWebhookConfig()) return NextResponse.json({ error: "WhatsApp belum dikonfigurasi." }, { status: 503 });
  const rawBody = await request.text();
  if (!verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }
  let messages: ParsedInbound[];
  try {
    messages = parseWebhook(JSON.parse(rawBody));
  } catch {
    return NextResponse.json({ error: "Invalid webhook body." }, { status: 400 });
  }
  if (messages.length) {
    after(async () => {
      for (const { messageId, from, msg } of messages) {
        try {
          if (!(await claimInbound(messageId, from))) continue;
          const engine = await getEngine();
          await sendReplies(from, (await engine.handle(msg)).replies);
        } catch (error) {
          console.error("WhatsApp webhook processing failed", { messageId, error });
        }
      }
    });
  }
  return NextResponse.json({ ok: true });
}
