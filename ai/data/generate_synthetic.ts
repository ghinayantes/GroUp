import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { generateText, Output } from "ai";
import { z } from "zod";
import { INTENTS, type Intent } from "@/lib/agent/types";
import { FIXTURE_BATCHES } from "@/test/fixtures/batches";
import { INTENT_DEFINITIONS } from "./intents";
import { readJsonl, writeJsonl, type IntentRow } from "./rows";

const BATCH_SIZE = 25;
const THROTTLE_MS = 3000;
const MAX_CONSECUTIVE_FAILURES = 5;
const STYLES = [
  "santai dan sopan",
  "banyak salah ketik",
  "penuh singkatan chat (yg, gk, brp, tp, dmn)",
  "campuran bahasa Jawa, Sunda, atau Betawi",
  "pakai emoji",
  "panjang dan bertele-tele (2–3 kalimat)",
];
const EXTRA_MATERIALS = [
  "beras",
  "telur ayam",
  "daging ayam",
  "bawang putih",
  "cabai rawit",
  "gula pasir",
  "kecap manis",
  "santan",
  "keju cheddar",
  "mentega",
];

const { values } = parseArgs({
  options: { "per-intent": { type: "string", default: "250" }, out: { type: "string", default: "ai/data/raw/synthetic.jsonl" } },
});
const perIntent = Number(values["per-intent"]);
const out = values.out!;
const model = process.env.AGENT_STAGE2_MODEL ?? "nvidia/nemotron-3.5-lightning-free";
const outputMode = process.env.AGENT_STAGE2_OUTPUT_MODE ?? "json-text";
const materials = [...FIXTURE_BATCHES.map((batch) => batch.name), ...EXTRA_MATERIALS];
const Messages = z.array(z.string().min(2).max(400));

function prompt(intent: Intent, style: string) {
  return [
    `Tulis ${BATCH_SIZE} pesan WhatsApp berbeda dari pembeli UMKM kuliner Indonesia ke layanan patungan bahan baku GroUp.`,
    `Semua pesan harus ber-intent "${intent}": ${INTENT_DEFINITIONS[intent]}.`,
    `Gaya: ${style}. Variasikan panjang, kata, dan bahan. Bahan yang bisa disebut: ${materials.join(", ")}.`,
    "Jangan menulis nomor telepon, nama orang, atau alamat. Satu pesan satu baris, tanpa penomoran.",
    outputMode === "json-text" ? "Balas HANYA dengan array JSON berisi string, tanpa teks lain." : "",
  ].join("\n");
}

async function generateBatch(intent: Intent, style: string): Promise<string[]> {
  if (outputMode === "native") {
    const { output } = await generateText({ model, output: Output.array({ element: z.string().min(2).max(400) }), prompt: prompt(intent, style) });
    return output;
  }
  const { text } = await generateText({ model, prompt: prompt(intent, style) });
  const json = text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
  return Messages.parse(JSON.parse(json));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const rows: IntentRow[] = existsSync(out) ? readJsonl<IntentRow>(out) : [];
  const seen = new Set(rows.map((row) => row.text.toLowerCase().trim()));
  let failures = 0;
  for (const intent of INTENTS) {
    let round = 0;
    while (rows.filter((row) => row.intent === intent).length < perIntent) {
      const style = STYLES[round++ % STYLES.length];
      if (failures >= MAX_CONSECUTIVE_FAILURES) throw new Error(`${failures} permintaan gagal berturut-turut; berhenti. Data yang sudah ada tersimpan di ${out}.`);
      try {
        const fresh = (await generateBatch(intent, style)).filter((text) => !seen.has(text.toLowerCase().trim()));
        for (const text of fresh) {
          seen.add(text.toLowerCase().trim());
          rows.push({ text, intent, source: "synthetic" });
        }
        writeJsonl(out, rows);
        failures = 0;
        console.log(`${intent} (${style}): +${fresh.length} → ${rows.filter((row) => row.intent === intent).length}/${perIntent}`);
      } catch (error) {
        failures += 1;
        console.error(`${intent} (${style}) gagal:`, error instanceof Error ? error.message : error);
      }
      await sleep(THROTTLE_MS);
    }
  }
}

await main();
