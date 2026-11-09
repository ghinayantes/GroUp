import { describe, expect, it } from "vitest";
import { INTENTS } from "@/lib/agent/types";
import { TEST_SET_RULES, validateRows } from "./validate";

const humanSet = () => INTENTS.flatMap((intent) => Array.from({ length: 34 }, (_, n) => ({ text: `${intent} pesan ${n}`, intent, source: "team" })));

describe("validateRows untuk set uji", () => {
  it("menerima set uji yang memenuhi aturan", () => {
    const result = validateRows(humanSet(), TEST_SET_RULES);
    expect(result.errors).toEqual([]);
    expect(result.counts.pesan_baru).toBe(34);
  });

  it("menolak sumber synthetic di set uji", () => {
    const rows = humanSet();
    rows[0] = { ...rows[0], source: "synthetic" };
    expect(validateRows(rows, TEST_SET_RULES).errors).toContainEqual(expect.stringMatching(/baris 1: source/));
  });

  it("menolak intent tak dikenal, teks kosong, dan bentuk bukan objek", () => {
    const errors = validateRows([{ text: "halo", intent: "salam", source: "team" }, { text: "  ", intent: "sapaan", source: "team" }, "x"], {
      ...TEST_SET_RULES,
      minTotal: 0,
      minPerIntent: 0,
    }).errors;
    expect(errors).toEqual([expect.stringMatching(/baris 1: intent/), expect.stringMatching(/baris 2: text/), expect.stringMatching(/baris 3/)]);
  });

  it("melaporkan intent yang kurang dari minimal dan total yang kurang", () => {
    const rows = humanSet().filter((r) => r.intent !== "catat_minat" || r.text.endsWith(" 1"));
    const errors = validateRows(rows, TEST_SET_RULES).errors;
    expect(errors).toContainEqual(expect.stringMatching(/catat_minat: 1 baris/));
  });

  it("melaporkan duplikat setelah normalisasi", () => {
    const rows = humanSet();
    rows[1] = { ...rows[1], text: `  ${rows[0].text.toUpperCase()} ` };
    expect(validateRows(rows, TEST_SET_RULES).errors).toContainEqual(expect.stringMatching(/baris 2: duplikat baris 1/));
  });
});
