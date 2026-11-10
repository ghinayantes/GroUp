import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium, type Page } from "playwright";

// Rekaman video demo ±60–75 detik. Setiap langkah yang gagal menghentikan skrip, jadi ini juga uji asap end-to-end.
const BASE = process.env.DEMO_BASE_URL || "http://localhost:3000";
const SIZE = { width: 1280, height: 720 };
const BUCKET = "site-media";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} belum diisi di .env.local`);
  return value;
}

function ffmpeg(args: string[]) {
  const result = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error(`ffmpeg gagal: ffmpeg ${args.join(" ")}`);
}

if (spawnSync("ffmpeg", ["-version"]).error) {
  throw new Error("ffmpeg tidak ditemukan. Pasang ffmpeg dan pastikan ada di PATH (misalnya `winget install ffmpeg` atau `brew install ffmpeg`).");
}
const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), { auth: { persistSession: false } });
const reachable = await fetch(BASE).then((response) => response.ok, () => false);
if (!reachable) throw new Error(`${BASE} tidak bisa dibuka. Jalankan \`npm run build && npm start\` dengan data \`npm run demo:seed\` dulu.`);

const work = mkdtempSync(path.join(tmpdir(), "group-demo-"));
const sampleImage = path.join(work, "cabai.jpg");
ffmpeg(["-f", "lavfi", "-i", "color=c=0xc0392b:s=1200x900", "-frames:v", "1", sampleImage]);

async function caption(page: Page, text: string) {
  await page.evaluate((value) => {
    let element = document.getElementById("demo-caption");
    if (!element) {
      element = document.createElement("div");
      element.id = "demo-caption";
      element.setAttribute("style", "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:9999;max-width:80%;padding:12px 22px;border-radius:999px;background:#1c2a20e6;color:#fff;font:600 20px/1.3 system-ui,sans-serif;text-align:center;box-shadow:0 10px 30px #0004");
      document.body.appendChild(element);
    }
    element.textContent = value;
  }, text);
  await page.waitForTimeout(1800);
}

async function signInAsDemo(page: Page, label: "Grosir" | "Admin", home: string) {
  await page.goto(`${BASE}/masuk`);
  await page.getByRole("button", { name: `Coba sebagai ${label}` }).first().click();
  await page.waitForURL(`${BASE}${home}**`, { timeout: 20_000 });
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: work, size: SIZE }, locale: "id-ID" });
const page = await context.newPage();
page.setDefaultTimeout(30_000);

try {
  // 1. Simulator: pesan bebas → tombol konfirmasi; pertanyaan harga → jawaban dari data PIHPS.
  await page.goto(`${BASE}/simulator`);
  await caption(page, "Pembeli cukup chat seperti biasa di WhatsApp");
  await page.getByPlaceholder("mis. Warung Bu Sari").fill("Warung Demo");
  await page.getByLabel("Ketik pesan").fill("mau ikut cabe 5 kilo");
  await page.keyboard.press("Enter");
  await page.locator(".chat-actions button").first().waitFor();
  await caption(page, "AI mengusulkan pesanan, tapi tetap butuh tombol konfirmasi");
  await page.getByLabel("Ketik pesan").fill("harga bawang merah di pasar berapa?");
  await page.keyboard.press("Enter");
  await page.locator(".chat-bubble-bot", { hasText: "Rp" }).last().waitFor();
  await caption(page, "Harga pasar diambil dari data PIHPS, bukan dikarang AI");

  // 2. Detail batch: badge hemat dan kartu kepercayaan supplier.
  await page.goto(`${BASE}/patungan`);
  await page.locator(".product-card", { has: page.locator(".fair-badge") }).first().locator("h3 a").click();
  await page.locator(".fair-panel").waitFor();
  await page.locator(".fair-panel").scrollIntoViewIfNeeded();
  await caption(page, "Cek harga wajar: dibanding harga pasar resmi, lengkap dengan prediksi");
  await page.locator(".trust-card").scrollIntoViewIfNeeded();
  await caption(page, "Rekam jejak supplier dari data, diringkas AI");

  // 3. Grosir: radar permintaan → buka batch dengan asisten harga dan upload foto.
  await signInAsDemo(page, "Grosir", "/grosir");
  await page.goto(`${BASE}/grosir/radar`);
  await page.locator(".radar-card").first().waitFor();
  await caption(page, "Grosir melihat permintaan nyata yang dikumpulkan agen");
  await page.locator(".radar-card", { has: page.locator(".detail-rules dt", { hasText: "Harga pasar" }) }).first().getByRole("link", { name: "Buka batch dari sinyal ini" }).click();
  await page.locator(".assistant-panel").waitFor();
  await caption(page, "Asisten harga menyarankan tier di bawah harga pasar");
  await page.getByRole("button", { name: "Pakai saran" }).click();
  await page.locator("input[type=file]").setInputFiles(sampleImage);
  await page.locator(".image-upload-preview img").waitFor();
  await caption(page, "Foto bahan diupload dan dikecilkan langsung di browser");

  // 4. Admin: Aktivitas AI.
  await page.getByRole("button", { name: "Keluar" }).click();
  await page.waitForURL(`${BASE}/`);
  await signInAsDemo(page, "Admin", "/admin");
  await page.goto(`${BASE}/admin/aktivitas-ai`);
  await page.locator(".stage-bars").waitFor();
  await caption(page, "Admin memantau setiap jalur agen: perintah baku, classifier, LLM, menu");
  await page.locator(".admin-table").scrollIntoViewIfNeeded();
  await caption(page, "GroUp: patungan bahan baku dengan AI yang bisa dipercaya");
} finally {
  await context.close();
  await browser.close();
}

const webm = await page.video()!.path();
const mp4 = path.join(work, "demo.mp4");
const poster = path.join(work, "poster.jpg");
ffmpeg(["-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", "-preset", "slow", "-movflags", "+faststart", "-an", mp4]);
ffmpeg(["-ss", "3", "-i", mp4, "-frames:v", "1", "-q:v", "3", poster]);

const urls: string[] = [];
for (const [file, contentType] of [[mp4, "video/mp4"], [poster, "image/jpeg"]] as const) {
  const target = `demo/${path.basename(file)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(target, readFileSync(file), { contentType, upsert: true, cacheControl: "3600" });
  if (error) throw new Error(`Upload ${target} gagal: ${error.message}`);
  urls.push(supabase.storage.from(BUCKET).getPublicUrl(target).data.publicUrl);
}

console.log([
  `Video dan poster tersimpan di ${work} dan bucket ${BUCKET}.`,
  "Isi env berikut (lokal dan Vercel), lalu deploy ulang:",
  `NEXT_PUBLIC_DEMO_VIDEO_URL=${urls[0]}`,
  `NEXT_PUBLIC_DEMO_POSTER_URL=${urls[1]}`,
].join("\n"));
