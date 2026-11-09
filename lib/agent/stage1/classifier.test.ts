import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { INTENTS } from "../types";
import { loadIntentClassifier, loadIntentScorer } from "./classifier";

const FIXTURE = path.join(import.meta.dirname, "__fixtures__", "tiny-classifier");
const temp = mkdtempSync(path.join(tmpdir(), "intent-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

function copyFixture(name: string, mutate?: (dir: string) => void) {
  const dir = path.join(temp, name);
  cpSync(FIXTURE, dir, { recursive: true });
  mutate?.(dir);
  return dir;
}

describe("loadIntentClassifier", () => {
  it("mengembalikan null untuk direktori tidak ada", async () => {
    expect(await loadIntentClassifier(path.join(temp, "tidak-ada"))).toBeNull();
  });

  it("mengembalikan null bila thresholds.json tidak ada", async () => {
    const dir = copyFixture("tanpa-ambang", (d) => rmSync(path.join(d, "thresholds.json")));
    expect(await loadIntentClassifier(dir)).toBeNull();
  });

  it("mengembalikan null bila label model bukan intent yang dikenal", async () => {
    const dir = copyFixture("label-asing", (d) => {
      const config = JSON.parse(readFileSync(path.join(d, "config.json"), "utf8"));
      config.id2label = { 0: "pesan_baru", 1: "LABEL_1" };
      writeFileSync(path.join(d, "config.json"), JSON.stringify(config));
    });
    expect(await loadIntentClassifier(dir)).toBeNull();
  });

  it("accepts memakai ambang per intent", async () => {
    const classifier = (await loadIntentClassifier(copyFixture("ambang")))!;
    expect(classifier.version).toBe("tiny-test");
    expect(classifier.accepts({ intent: "pesan_baru", confidence: 0.4 })).toBe(true);
    expect(classifier.accepts({ intent: "pesan_baru", confidence: 0.39 })).toBe(false);
    expect(classifier.accepts({ intent: "sapaan", confidence: 0.89 })).toBe(false);
    expect(classifier.accepts({ intent: "tanya_info", confidence: 1 })).toBe(false);
  });

  it("memuat model ONNX lokal tanpa jaringan dan mengembalikan intent dari label model", async () => {
    const classifier = (await loadIntentClassifier(copyFixture("asli")))!;
    const score = await classifier.classify("mau ikut cabe 5 kilo");
    expect(["pesan_baru", "sapaan"]).toContain(score.intent);
    expect(score.confidence).toBeGreaterThan(0);
    expect(score.confidence).toBeLessThanOrEqual(1);
  });

  it("loadIntentScorer memuat model tanpa thresholds.json untuk kalibrasi", async () => {
    const dir = copyFixture("skor-saja", (d) => rmSync(path.join(d, "thresholds.json")));
    const score = await (await loadIntentScorer(dir))("halo kak");
    expect(["pesan_baru", "sapaan"]).toContain(score.intent);
  });

  it("loadIntentScorer melempar error bila model tidak ada", async () => {
    await expect(loadIntentScorer(path.join(temp, "kosong"))).rejects.toThrow(/model_quantized.onnx/);
  });

  it("instance dipakai ulang untuk direktori yang sama", async () => {
    const dir = copyFixture("singleton");
    expect(loadIntentClassifier(dir)).toBe(loadIntentClassifier(dir));
  });

  const realModel = path.join(process.cwd(), "models/intent-classifier");
  it.skipIf(!existsSync(path.join(realModel, "onnx")))(
    "model asli mengklasifikasi 'mau ikut cabe 5 kilo' sebagai pesan_baru dalam < 300 ms setelah pemanasan",
    async () => {
      const classifier = (await loadIntentClassifier(realModel))!;
      await classifier.classify("halo");
      const started = performance.now();
      const score = await classifier.classify("mau ikut cabe 5 kilo");
      expect(performance.now() - started).toBeLessThan(300);
      expect(score.intent).toBe("pesan_baru");
      expect(INTENTS).toContain(score.intent);
    },
  );
});
