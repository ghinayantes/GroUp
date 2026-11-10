"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Permintaan gagal.");
  return result;
}

export function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run<T>(task: () => Promise<T>, success: string | ((result: T) => string)) {
    setBusy(true); setMessage("");
    try { const result = await task(); setMessage(typeof success === "string" ? success : success(result)); router.refresh(); return true; }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Permintaan gagal."); return false; }
    finally { setBusy(false); }
  }
  return { busy, message, run };
}
