import { describe, expect, it } from "vitest";
import { INTENTS } from "@/lib/agent/types";
import { mulberry32 } from "./augment";
import type { IntentRow } from "./rows";
import { dedupeAgainst, mergeExact, stratifiedSplit } from "./split";

const row = (text: string, intent: IntentRow["intent"] = "pesan_baru"): IntentRow => ({ text, intent, source: "synthetic" });

describe("mergeExact", () => {
  it("menyimpan satu baris per teks dan memilih versi tim bila sama dengan sintetis", () => {
    const team: IntentRow = { text: "Batal yg cabe ya", intent: "batal_pesanan", source: "team" };
    const { rows, duplicates, relabeled } = mergeExact([
      row("batal  yg cabe ya", "ubah_pesanan"),
      team,
      row("kapan bayarnya kak", "tanya_info"),
      row("KAPAN BAYARNYA KAK", "tanya_info"),
    ]);
    expect(rows).toEqual([team, row("kapan bayarnya kak", "tanya_info")]);
    expect(duplicates).toBe(2);
    expect(relabeled).toBe(1);
  });

  it("tidak mengganti baris tim dengan baris sintetis yang datang belakangan", () => {
    const team: IntentRow = { text: "halo kak", intent: "sapaan", source: "team" };
    expect(mergeExact([team, row("halo kak", "sapaan")]).rows).toEqual([team]);
  });
});

describe("dedupeAgainst", () => {
  it('membuang "mau ikut cabe 5kg" bila test berisi "mau ikut cabe 5 kg"', () => {
    const kept = dedupeAgainst([row("mau ikut cabe 5kg"), row("kapan bayarnya kak", "tanya_info")], [row("mau ikut cabe 5 kg")]);
    expect(kept.map((r) => r.text)).toEqual(["kapan bayarnya kak"]);
  });

  it("membuang baris latih yang membungkus teks uji berisi minimal 3 kata", () => {
    const kept = dedupeAgainst(
      [row("permisi min, dftr ayam 2kg ya"), row("dftr ayam 20kg buat warung"), row("pagi min saya mau ikut gula 10 kg")],
      [row("dftr ayam 2kg"), row("pagi min", "sapaan")],
    );
    expect(kept.map((r) => r.text)).toEqual(["dftr ayam 20kg buat warung", "pagi min saya mau ikut gula 10 kg"]);
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
