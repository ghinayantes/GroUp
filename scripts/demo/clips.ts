import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium, type Locator, type Page } from "playwright";
import { DEMO_SCENARIOS, DEMO_STEPS, type DemoClipTiming, type DemoScenario } from "@/lib/demo-clips";

const { values } = parseArgs({ options: { base: { type: "string" }, channel: { type: "string" }, only: { type: "string" } } });
const BASE = values.base || process.env.DEMO_BASE_URL || "http://localhost:3000";
const VIEWPORT = { width: 1176, height: 532 };
const OUT_DIR = "public/demo";
const TIMINGS_FILE = "lib/demo-clips.json";
const ATTEMPTS = 3;
const REPLY_TIMEOUT_MS = 30_000;

// Panel simulator dibuat memenuhi viewport supaya rekaman tidak perlu dipotong.
const ISOLATE_CSS = `
body::before{content:"";position:fixed;inset:0;background:#0d1610;z-index:9998}
.chat-sim-layout{position:fixed;inset:12px;z-index:9999;margin:0}
`;

const lastReply = (page: Page) => page.locator(".chat-bubble-bot:not(.chat-typing)").last();

const EXPECTATIONS: Record<string, (reply: Locator) => Promise<boolean>> = {
  "ikut-batch": async (reply) => (await reply.getByRole("button", { name: "Ya, ikut" }).count()) > 0,
  "harga-pasar": async (reply) => /PIHPS/.test(await reply.innerText()) && /Rp/.test(await reply.innerText()),
  "tolak-manipulasi": async (reply) => (await reply.locator(".chat-actions button").count()) === 0 && !/gratis/i.test(await reply.innerText()),
};

const seconds = (ms: number) => Math.round(ms / 100) / 10;

async function record(scenario: DemoScenario, video: string, poster: string) {
  const browser = await chromium.launch(values.channel ? { channel: values.channel } : {});
  const page = await browser.newPage({ viewport: VIEWPORT, locale: "id-ID" });
  page.setDefaultTimeout(60_000);
  const marks: number[] = [];
  let ok = false;
  try {
    await page.goto(`${BASE}/simulator`, { waitUntil: "domcontentloaded" });
    await page.locator(".chat-sim-layout").waitFor();
    await page.addStyleTag({ content: ISOLATE_CSS });
    await page.getByPlaceholder("mis. Warung Bu Sari").fill("Warung Demo");
    await page.locator(".chat-trace summary").click();
    await page.waitForTimeout(800);

    await page.screencast.start({ path: video, size: VIEWPORT, fps: 25, quality: 90 });
    const t0 = Date.now();
    const mark = () => marks.push(Date.now() - t0);
    await page.waitForTimeout(500);
    mark();
    const input = page.getByLabel("Ketik pesan");
    await input.click();
    await input.pressSequentially(scenario.message, { delay: 55 });
    await page.waitForTimeout(300);
    const before = await page.locator(".chat-bubble-bot:not(.chat-typing)").count();
    await input.press("Enter");
    mark();
    await page.locator(".chat-bubble-bot:not(.chat-typing)").nth(before).waitFor({ timeout: REPLY_TIMEOUT_MS });
    mark();
    ok = await EXPECTATIONS[scenario.id](lastReply(page));
    await page.waitForTimeout(1600);
    mark();
    if (scenario.id === "ikut-batch") await lastReply(page).getByRole("button", { name: "Ya, ikut" }).hover();
    await page.waitForTimeout(3200);
    await page.screenshot({ path: poster, type: "jpeg", quality: 82 });
    mark();
    await page.screencast.stop();
  } finally {
    await browser.close();
  }
  return { ok, marks };
}

function vtt(scenario: DemoScenario, timing: DemoClipTiming) {
  const stamp = (s: number) => `00:${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(3).padStart(6, "0")}`;
  const cues = timing.steps.map((start, index) => {
    const end = timing.steps[index + 1] ?? timing.duration;
    return `${stamp(start)} --> ${stamp(end)}\n${DEMO_STEPS[index]}: ${scenario.steps[index]}`;
  });
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

mkdirSync(OUT_DIR, { recursive: true });
const timings: Record<string, DemoClipTiming> = existsSync(TIMINGS_FILE) ? JSON.parse(readFileSync(TIMINGS_FILE, "utf8")) : {};

for (const scenario of DEMO_SCENARIOS.filter((s) => !values.only || s.id === values.only)) {
  const video = path.join(OUT_DIR, `${scenario.id}.webm`);
  const poster = path.join(OUT_DIR, `${scenario.id}.jpg`);
  let result: Awaited<ReturnType<typeof record>> | null = null;
  for (let attempt = 1; attempt <= ATTEMPTS && !result?.ok; attempt++) {
    try {
      result = await record(scenario, video, poster);
      console.log(`${scenario.id} percobaan ${attempt}: ${result.ok ? "sesuai" : "balasan tidak sesuai harapan"}`);
    } catch (error) {
      result = null;
      console.log(`${scenario.id} percobaan ${attempt} gagal: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
    }
  }
  if (!result?.ok) {
    rmSync(video, { force: true });
    rmSync(poster, { force: true });
    throw new Error(`${scenario.id}: balasan tidak sesuai harapan setelah ${ATTEMPTS} percobaan.`);
  }

  const [typing, sent, replied, checked, end] = result.marks;
  const timing: DemoClipTiming = { duration: seconds(end), steps: [seconds(typing), seconds(sent), seconds(replied), seconds(checked)] };
  writeFileSync(path.join(OUT_DIR, `${scenario.id}.vtt`), vtt(scenario, timing));
  timings[scenario.id] = timing;
  console.log(`${scenario.id}: ${timing.duration} dtk, langkah ${timing.steps.join(" / ")}`);
}

writeFileSync(TIMINGS_FILE, `${JSON.stringify(timings, null, 2)}\n`);
console.log(`Klip di ${OUT_DIR}, waktu langkah di ${TIMINGS_FILE}.`);
