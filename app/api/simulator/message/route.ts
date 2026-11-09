import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { readJson } from "@/lib/admin-route";
import { getEngine } from "@/lib/agent/runtime";
import type { InboundMessage } from "@/lib/agent/types";

const COOKIE = "sim_session";
const SENDER_KEY = /^sim-[0-9a-f]{16}$/;
const MAX_TEXT = 1000;
const MAX_REPLY_FIELD = 200;
const NAME_LENGTH = { min: 2, max: 80 };

const optionalString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const text = optionalString(body?.text);
  const replyId = optionalString(body?.replyId).slice(0, MAX_REPLY_FIELD);
  const replyTitle = optionalString(body?.replyTitle).slice(0, MAX_REPLY_FIELD);
  if (!text && !replyId) return NextResponse.json({ error: "Tulis pesan dulu, ya." }, { status: 400 });
  if (text.length > MAX_TEXT) return NextResponse.json({ error: "Pesannya kepanjangan, maksimal 1.000 karakter ya." }, { status: 400 });
  const profileName = optionalString(body?.profileName).replace(/\s+/g, " ");
  if (profileName.length < NAME_LENGTH.min || profileName.length > NAME_LENGTH.max) {
    return NextResponse.json({ error: "Isi nama usaha dulu, 2–80 karakter." }, { status: 400 });
  }

  const existing = request.cookies.get(COOKIE)?.value;
  const senderKey = existing && SENDER_KEY.test(existing) ? existing : `sim-${randomBytes(8).toString("hex")}`;

  const msg: InboundMessage = {
    channel: "simulator",
    senderKey,
    messageId: crypto.randomUUID(),
    profileName,
    ...(replyId ? { kind: "interactive", text: replyTitle, replyId } : { kind: "text", text }),
  };
  const result = await (await getEngine()).handle(msg);

  const response = NextResponse.json(result);
  if (senderKey !== existing) {
    response.cookies.set(COOKIE, senderKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
  }
  return response;
}
