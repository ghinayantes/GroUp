# Catatan lanjutan track AI

**Ditulis:** 2026-11-09, setelah `build-AI` di-merge ke `main` (`667f66e`) dan AI aktif di production.
**Basis branch ini:** sama dengan `main` per `bd7cba2`. Tarik `main` lagi sebelum mulai kerja.

## Yang berubah di `main` dan berpengaruh ke track AI

1. **Penyedia model tahap 2 kini dipilih lewat env** (`lib/agent/model-provider.ts`, dipakai `runtime.ts`, `npm run eval`, `npm run data:generate`).
   - AI Gateway menolak semua permintaan tanpa kartu kredit terdaftar, termasuk model `-free` dan OIDC. Tim tidak punya kartu internasional.
   - Production sekarang memakai **Gemini** (`AGENT_STAGE2_PROVIDER=google`, model default `gemini-3.5-flash-lite`). `gemini-2.5-*` tidak tersedia untuk pengguna baru.

   | Env | Isi |
   |---|---|
   | `AGENT_STAGE2_PROVIDER` | `gateway` (default) · `google` · `openai-compatible` |
   | `AGENT_STAGE2_MODEL` | ID model. Kosong → `gateway`: Nemotron, `google`: `gemini-3.5-flash-lite`. Wajib untuk `openai-compatible` |
   | `GOOGLE_GENERATIVE_AI_API_KEY` | Kunci dari https://aistudio.google.com/apikey (tanpa kartu) |
   | `AGENT_STAGE2_BASE_URL`, `AGENT_STAGE2_API_KEY` | OpenCode Zen (`https://opencode.ai/zen/v1`), OpenRouter, NVIDIA NIM, Groq |
   | `AGENT_STAGE2_OUTPUT_MODE` | `json-text` (default) · `native` |

   Konfigurasi tidak lengkap → tahap 2 mati dengan peringatan (aplikasi) atau error (eval). Label model di trace dan kunci cache eval: `google/<model>`, `openai-compatible/<model>`, atau ID Gateway.
2. **`runtime.ts` sudah tersambung** (`ee0c3d0`): `loadIntentClassifier()`, tahap 2 dari env, `marketPrice: createMarketPricePort()`. Tidak perlu usulan wiring lagi.
3. **Batas 20 panggilan/jam diperbaiki** (`cff9139`): trace `fallback` setelah tahap 2 error kini membawa `stage2.model`, dan `countStage2Since` menghitung semua trace dengan `model` terisi. Ini menyentuh `lib/agent/understand.ts` (hanya field `model` di cabang error).
4. **Harga pasar: JSON adalah satu-satunya sumber.** Tabel snapshot Supabase dihapus (`9864aa3`). Pembaruan harga = jalankan pipeline → commit `ai/harga/output/prediksi.json` → push → deploy.
5. `npm test` butuh venv Python untuk `ai/harga/pytest.test.ts`; tanpa itu pakai `SKIP_PYTEST=1`.

## Hasil uji Gemini (belum spike resmi)

Spike mini lokal, 4 pesan × 2 mode, batch fixture + harga PIHPS asli, `gemini-3.5-flash-lite`:
- 6/8 berhasil, 2 timeout di 12 detik (satu per mode). Latensi 1,3–9,6 detik.
- Tools dipanggil dengan benar (`harga_pasar`, `cari_batch`, `detail_batch`).
- Production: tiga pertanyaan harga pasar dijawab benar lewat `harga_pasar`; latensi engine ±4,6 detik, total permintaan 7–9 detik (sekali 26 detik).

## Temuan yang perlu ditangani track AI

1. **Tanggal salah lolos grounding.** Mode native menjawab "per tanggal 2 Maret 2026" padahal data `2026-11-02`. `isGrounded` hanya mencocokkan angka, sehingga nama bulan yang salah tidak tertangkap. Usulan: format tanggal di output tool sudah berupa teks Indonesia (mis. `tanggal_teks: "2 November 2026"`) dan grounding juga mencocokkan nama bulan.
2. **Timeout 12 detik terlalu ketat untuk Gemini Flash Lite.** Ukur p95 di spike; pertimbangkan `gemini-3.5-flash` atau penyedia lain sebelum menaikkan timeout (WhatsApp tetap butuh balasan cepat).
3. **Data latih dan privasi.** Tier gratis Gemini memakai prompt untuk melatih model di luar EEA/UK/Swiss. Redaksi tetap wajib; model card dan halaman transparansi harus menyebut ini.
4. **Minor yang tertunda dari review akhir:** tanda minus dibuang, grounding menolak angka dari konteks, bahan kedua yang tak cocok hilang tanpa pemberitahuan.

## Pekerjaan berikutnya (urut)

1. **Spike Tugas 1 dengan Gemini:** 20 pesan × `json-text`/`native`. Tetapkan `AGENT_STAGE2_OUTPUT_MODE` (native bila ≥ 90% valid; lapor bila keduanya < 70%). Catat juga p50/p95 latensi.
2. **[TIM] Dataset** (paling lambat 13 Nov):
   - `ai/data/test.jsonl` ≥ 300 baris tulisan manusia, ≥ 25 per intent;
   - `ai/data/raw/team.jsonl`;
   - `evals/datasets/extract.jsonl` (±150), `e2e.json` (±80), `safety.json` (±40).
   Format: `ai/data/intent_guidelines.md`, `evals/datasets/README.md`.
3. **Classifier tahap 1:** `npm run data:generate` (pakai env penyedia di atas) → `data:build` → latih di Colab → salin artefak ke `models/intent-classifier/` → `npm run model:calibrate`. Cek ukuran < 30 MB dan p95 < 300 ms; setelah deploy, cek `.nft.json` route webhook/simulator memuat model.
4. **Eval Tugas 17:** `npm run eval` untuk `fixed-only`, `llm-only`, `router` → `npm run eval:report` → isi `evals/REPORT.md` dan `models/intent-classifier/MODEL_CARD.md`. `evals/pricing.json` perlu baris untuk model Gemini yang dipakai.
5. **Pipeline harga** (`ai/harga`):
   - tambahkan `skema: 1` di `prediksi.json`;
   - `dibuat` memakai `pd.Timestamp.now(tz="Asia/Jakarta")`;
   - `tulis_json` mengubah tanggal ke string sebelum NaN dibersihkan, jadi tanggal kosong keluar sebagai `"NaT"`;
   - keputusan harga minyak goreng per liter masih menunggu pemilik proyek.

## Yang dikerjakan fullstack di `main` (jangan disentuh dulu)
Tugas 16 (label 🤖 + `/transparansi-ai`), aturan WAF simulator, README bagian AI, halaman `/harga-pasar`. Perubahan `types.ts`/`ports.ts` tetap harus disepakati dan dikerjakan dalam commit terpisah.
