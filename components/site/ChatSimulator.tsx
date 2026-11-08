"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/site/Icon";
import Modal from "@/components/site/Modal";
import type { Reply, TraceRecord } from "@/lib/agent/types";

type Entry = { id: number; from: "user"; text: string } | { id: number; from: "bot"; reply: Reply; turn: number };
type Turn = { id: number; input: string; trace: TraceRecord };
type ListReply = Extract<Reply, { kind: "list" }>;
type Outgoing = { text: string } | { replyId: string; replyTitle: string };

const SUGGESTIONS = ["MULAI", "PESANAN", "Harga cabai berapa?"];

const stageLabel: Record<TraceRecord["stage"], string> = { fixed: "Perintah tetap", stage1: "Tahap 1 (klasifikasi)", stage2: "Tahap 2 (LLM)", fallback: "Cadangan" };

const show = (value: unknown) => (value === null || value === undefined || (Array.isArray(value) && value.length === 0) ? "—" : typeof value === "string" ? value : JSON.stringify(value));

export default function ChatSimulator() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picker, setPicker] = useState<ListReply | null>(null);
  const [usedTurns, setUsedTurns] = useState<Set<number>>(new Set());
  const nextId = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [entries, busy]);

  async function send(outgoing: Outgoing, fromTurn?: number) {
    if (busy || ("text" in outgoing && !outgoing.text.trim())) return;
    const label = "text" in outgoing ? outgoing.text.trim() : outgoing.replyTitle;
    setBusy(true);
    setError("");
    setPicker(null);
    if (fromTurn !== undefined) setUsedTurns((used) => new Set(used).add(fromTurn));
    const userEntry: Entry = { id: nextId.current++, from: "user", text: label };
    setEntries((list) => [...list, userEntry]);
    try {
      const response = await fetch("/api/simulator/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify("text" in outgoing ? { text: outgoing.text.trim() } : outgoing),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Pesan belum terkirim. Coba lagi, ya.");
      const turn = nextId.current++;
      const { replies, trace } = result as { replies: Reply[]; trace: TraceRecord };
      setTurns((list) => [...list, { id: turn, input: label, trace }]);
      setEntries((list) => [...list, ...replies.map((reply) => ({ id: nextId.current++, from: "bot" as const, reply, turn }))]);
      if ("text" in outgoing) setDraft("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pesan belum terkirim. Coba lagi, ya.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="chat-sim-layout">
    <section className="chat-sim" aria-label="Simulator chat WhatsApp">
      <header className="chat-sim-head">
        <span className="chat-sim-avatar" aria-hidden="true">BB</span>
        <div><b>GroUp</b><small>{busy ? "sedang mengetik…" : "Asisten patungan"}</small></div>
      </header>
      <p className="chat-sim-note">Ini simulator. Pesananmu tercatat sebagai pesanan simulator dan bisa dihapus pengelola.</p>
      <div className="chat-sim-log" ref={logRef} aria-live="polite">
        {entries.length === 0 && <div className="chat-sim-empty">
          <p>Coba kirim <b>MULAI</b> untuk melihat batch yang sedang dibuka.</p>
          <div className="chat-sim-chips">{SUGGESTIONS.map((s) => <button key={s} type="button" className="pill" disabled={busy} onClick={() => send({ text: s })}>{s}</button>)}</div>
        </div>}
        {entries.map((entry) => entry.from === "user"
          ? <div key={entry.id} className="chat-bubble chat-bubble-user">{entry.text}</div>
          : <BotBubble key={entry.id} reply={entry.reply} disabled={busy || usedTurns.has(entry.turn)}
              onButton={(id, title) => send({ replyId: id, replyTitle: title }, entry.turn)}
              onList={() => entry.reply.kind === "list" && setPicker(entry.reply)} />)}
        {busy && <div className="chat-bubble chat-bubble-bot chat-typing" aria-label="Sedang membalas"><i /><i /><i /></div>}
      </div>
      {error && <p className="form-error chat-sim-error" role="alert">{error}</p>}
      <form className="chat-sim-input" onSubmit={(event) => { event.preventDefault(); send({ text: draft }); }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000} placeholder="Ketik pesan" aria-label="Ketik pesan" disabled={busy} />
        <button type="submit" aria-label="Kirim" disabled={busy || !draft.trim()}><Icon name="arrow" size={20} /></button>
      </form>
    </section>

    <details className="chat-trace">
      <summary>Di balik layar <small>{turns.length} pesan</small></summary>
      {turns.length === 0 ? <p className="chat-trace-empty">Kirim pesan untuk melihat cara agen memprosesnya.</p> :
      <ol>{[...turns].reverse().map(({ id, input, trace }) => <li key={id}>
        <b className="chat-trace-input">“{input}”</b>
        <dl>
          <dt>Tahap</dt><dd>{stageLabel[trace.stage]}</dd>
          <dt>Intent</dt><dd>{show(trace.intent)}</dd>
          <dt>Keyakinan</dt><dd>{trace.confidence === null ? "—" : `${Math.round(trace.confidence * 100)}%`}</dd>
          <dt>Slot</dt><dd><code>{show(trace.slots)}</code></dd>
          <dt>Tool</dt><dd>{show(trace.tools)}</dd>
          <dt>Latensi</dt><dd>{Math.round(trace.latencyMs)} ms</dd>
          <dt>Token</dt><dd>{trace.inputTokens === null && trace.outputTokens === null ? "—" : `${trace.inputTokens ?? 0} masuk · ${trace.outputTokens ?? 0} keluar`}</dd>
        </dl>
      </li>)}</ol>}
    </details>

    {picker && <Modal onClose={() => setPicker(null)} labelledBy="chat-picker-title">
      <span className="modal-eyebrow">PILIH BATCH</span>
      <h2 id="chat-picker-title">{picker.button}</h2>
      <ul className="chat-picker">{picker.rows.map((row) => <li key={row.id}>
        <button type="button" disabled={busy} onClick={() => send({ replyId: row.id, replyTitle: row.title })}>
          <b>{row.title}</b>{row.description && <small>{row.description}</small>}
        </button>
      </li>)}</ul>
    </Modal>}
  </div>;
}

function BotBubble({ reply, disabled, onButton, onList }: { reply: Reply; disabled: boolean; onButton: (id: string, title: string) => void; onList: () => void }) {
  return <div className="chat-bubble chat-bubble-bot">
    {reply.kind === "text" && reply.aiGenerated && <span className="chat-ai-badge">AI</span>}
    <p>{reply.body}</p>
    {reply.kind === "list" && <div className="chat-actions"><button type="button" disabled={disabled} onClick={onList}><Icon name="filter" size={16} />Pilih batch</button></div>}
    {reply.kind === "buttons" && <div className="chat-actions">{reply.buttons.map((button) =>
      <button key={button.id} type="button" disabled={disabled} onClick={() => onButton(button.id, button.title)}>{button.title}</button>)}</div>}
  </div>;
}
