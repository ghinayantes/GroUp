import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium, type Locator, type Page } from "playwright";
import { DEMO_SCENARIOS, DEMO_STEPS, type DemoClipTiming, type DemoScenario } from "@/lib/demo-clips";

const { values } = parseArgs({ options: { base: { type: "string" }, channel: { type: "string" }, only: { type: "string" } } });
const BASE = values.base || process.env.DEMO_BASE_URL || "http://localhost:3000";
const VIEWPORT = { width: 1280, height: 800 };
const OUT_DIR = "public/demo";
const TIMINGS_FILE = "lib/demo-clips.json";
const ATTEMPTS = 3;
const REPLY_TIMEOUT_MS = 30_000;
const PAD = 12;

function ffmpeg(args: string[]) {
  const result = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error(`ffmpeg gagal: ffmpeg ${args.join(" ")}`);
}

if (spawnSync("ffmpeg", ["-version"]).error) throw new Error("ffmpeg tidak ditemukan di PATH.");

const lastReply = (page: Page) => page.locator(".chat-bubble-bot:not(.chat-typing)").last();

const EXPECTATIONS: Record<string, (reply: Locator) => Promise<boolean>> = {
  "ikut-batch": async (reply) => (await reply.getByRole("button", { name: "Ya, ikut" }).count()) > 0,
  "harga-pasar": async (reply) => /PIHPS/.test(await reply.innerText()) && /Rp/.test(await reply.innerText()),
  "tolak-manipulasi": async (reply) => (await reply.locator(".chat-actions button").count()) === 0 && !/gratis/i.test(await reply.innerText()),
};

const seconds = (ms: number) => Math.round(ms / 100) / 10;
const even = (n: number) => Math.floor(n / 2) * 2;

async function record(scenario: DemoScenario, work: string) {
  const browser = await chromium.launch(values.channel ? { channel: values.channel } : {});
  const context = await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir: work, size: VIEWPORT }, locale: "id-ID" });
  const page = await context.newPage();
  const videoStart = Date.now();
  page.setDefaultTimeout(60_000);
  let ok = false;
  let marks: number[] = [];
  let crop = "";
  try {
    await page.goto(`${BASE}/simulator`, { waitUntil: "domcontentloaded" });
    const layout = page.locator(".chat-sim-layout");
    await layout.waitFor();
    await page.getByPlaceholder("mis. Warung Bu Sari").fill("Warung Demo");
    await page.locator(".chat-trace summary").click();
    await page.evaluate(() => {
      const element = document.querySelector(".chat-sim-layout");
      if (element) window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 12);
    });
    await page.waitForTimeout(800);
    const box = (await layout.boundingBox())!;
    const x = Math.max(0, Math.floor(box.x - PAD));
    const y = Math.max(0, Math.floor(box.y - PAD));
    crop = `crop=${even(Math.min(VIEWPORT.width - x, box.width + PAD * 2))}:${even(Math.min(VIEWPORT.height - y, box.height + PAD * 2))}:${x}:${y}`;

    const t0 = Date.now();
    await page.waitForTimeout(500);
    marks.push(Date.now() - t0);
    const input = page.getByLabel("Ketik pesan");
    await input.click();
    await input.pressSequentially(scenario.message, { delay: 55 });
    await page.waitForTimeout(300);
    const before = await page.locator(".chat-bubble-bot:not(.chat-typing)").count();
    await page.keyboard.press("Enter");
    marks.push(Date.now() - t0);
    await page.waitForFunction((n) => document.querySelectorAll(".chat-bubble-bot:not(.chat-typing)").length > n, before, { timeout: REPLY_TIMEOUT_MS });
    marks.push(Date.now() - t0);
    ok = await EXPECTATIONS[scenario.id](lastReply(page));
    await page.waitForTimeout(1600);
    marks.push(Date.now() - t0);
    if (scenario.id === "ikut-batch") await lastReply(page).getByRole("button", { name: "Ya, ikut" }).hover();
    await page.waitForTimeout(3200);
    marks = [...marks, Date.now() - t0, t0 - videoStart];
  } finally {
    await context.close();
    await browser.close();
  }
  return { ok, marks, crop, webm: await page.video()!.path() };
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
const work = mkdtempSync(path.join(tmpdir(), "group-clips-"));
const timings: Record<string, DemoClipTiming> = existsSync(TIMINGS_FILE) ? JSON.parse(readFileSync(TIMINGS_FILE, "utf8")) : {};

for (const scenario of DEMO_SCENARIOS.filter((s) => !values.only || s.id === values.only)) {
  let result: Awaited<ReturnType<typeof record>> | null = null;
  for (let attempt = 1; attempt <= ATTEMPTS && !result?.ok; attempt++) {
    result = await record(scenario, work);
    console.log(`${scenario.id} percobaan ${attempt}: ${result.ok ? "sesuai" : "balasan tidak sesuai harapan"}`);
  }
  if (!result?.ok) throw new Error(`${scenario.id}: balasan tidak sesuai harapan setelah ${ATTEMPTS} percobaan.`);

  const [typing, sent, replied, checked, end, offset] = result.marks;
  const timing: DemoClipTiming = { duration: seconds(end), steps: [seconds(typing), seconds(sent), seconds(replied), seconds(checked)] };
  const mp4 = path.join(OUT_DIR, `${scenario.id}.mp4`);
  ffmpeg(["-i", result.webm, "-ss", String(offset / 1000), "-t", String(end / 1000), "-vf", `${result.crop},fps=30`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", "-preset", "slow", "-movflags", "+faststart", "-an", mp4]);
  ffmpeg(["-sseof", "-0.4", "-i", mp4, "-frames:v", "1", "-q:v", "3", path.join(OUT_DIR, `${scenario.id}.jpg`)]);
  writeFileSync(path.join(OUT_DIR, `${scenario.id}.vtt`), vtt(scenario, timing));
  timings[scenario.id] = timing;
  console.log(`${scenario.id}: ${timing.duration} dtk, langkah ${timing.steps.join(" / ")}`);
}

writeFileSync(TIMINGS_FILE, `${JSON.stringify(timings, null, 2)}\n`);
console.log(`Klip di ${OUT_DIR}, waktu langkah di ${TIMINGS_FILE}.`);
