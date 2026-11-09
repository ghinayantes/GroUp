import { describe, expect, it } from "vitest";
import { INTENTS } from "@/lib/agent/types";
import { mulberry32 } from "./augment";
import type { IntentRow } from "./rows";
import { dedupeAgainst, stratifiedSplit } from "./split";

const row = (text: string, intent: IntentRow["intent"] = "pesan_baru"): IntentRow => ({ text, intent, source: "synthetic" });

describe("dedupeAgainst", () => {
  it('membuang "mau ikut cabe 5kg" bila test berisi "mau ikut cabe 5 kg"', () => {
    const kept = dedupeAgainst([row("mau ikut cabe 5kg"), row("kapan bayarnya kak", "tanya_info")], [row("mau ikut cabe 5 kg")]);
    expect(kept.map((r) => r.text)).toEqual(["kapan bayarnya kak"]);
  });
});

describe("stratifiedSplit", () => {
  const rows = INTENTS.flatMap((intent, i) => Array.from({ length: 40 + i * 20 }, (_, n) => row(`${intent} contoh ${n}`, intent)));

  it("menjaga minimal 10 per intent di val dan tidak ada baris di kedua set", () => {
    const { train, val } = stratifiedSplit(rows, 100, mulberry32(42));
    for (const intent of INTENTS) expect(val.filter((r) => r.intent === intent).length).toBeGreaterThanOrEqual(10);
    const trainTexts = new Set(train.map((r) => r.text));
    expect(val.some((r) => trainTexts.has(r.text))).toBe(false);
    expect(train.length + val.length).toBe(rows.length);
  });

  it("menjaga proporsi intent kira-kira", () => {
    const { val } = stratifiedSplit(rows, 300, mulberry32(42));
    const big = val.filter((r) => r.intent === "di_luar_topik").length;
    const small = val.filter((r) => r.intent === "pesan_baru").length;
    expect(big).toBeGreaterThan(small);
  });

  it("melempar error bila intent terlalu sedikit untuk 10 baris val", () => {
    expect(() => stratifiedSplit([...rows, row("satu-satunya", "sapaan")].filter((r) => r.intent !== "sapaan" || r.text === "satu-satunya"), 100, mulberry32(1))).toThrow(/sapaan/);
  });

  it("deterministik untuk seed sama", () => {
    expect(stratifiedSplit(rows, 100, mulberry32(5))).toEqual(stratifiedSplit(rows, 100, mulberry32(5)));
  });
});
