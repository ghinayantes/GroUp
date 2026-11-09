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
   | `AGENT_STAGE2_THINKING_LEVEL` | Khusus `google`: `minimal` (default) · `low` · `medium` · `high`. Ikut masuk kunci cache eval |

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

1. **✅ Tanggal salah lolos grounding.** Mode native menjawab "per tanggal 2 Maret 2026" padahal data `2026-11-02`. Sudah ditangani: `harga_pasar` kini mengembalikan `tanggal_teks` ("2 November 2026"), prompt meminta tanggal ditulis dari situ, dan `isGrounded` menolak nama bulan yang tidak cocok dengan tanggal di output tool (bulan WIB dan UTC dari timestamp sama-sama diterima).
2. **Latensi terlalu tinggi; aplikasi terasa lambat saat diuji.** Timeout 12 detik pun masih terlewati. Jangan menaikkan timeout; turunkan latensinya. Lihat bagian "Saran menurunkan latensi" di bawah.
3. **Data latih dan privasi.** Syarat Gemini API (berlaku 23 Maret 2026): untuk layanan tidak berbayar, Google memakai prompt dan respons untuk mengembangkan produknya, dan peninjau manusia bisa membacanya. Redaksi tetap wajib. Model card sudah menyebut ini (✅); **`/transparansi-ai` (fullstack) belum**. Soal data sintetis: syaratnya melarang memakai layanan untuk mengembangkan model yang *bersaing dengan Gemini API/AI Studio*, dan tidak mengatur langsung pemakaian output untuk melatih model lain. Classifier 9 intent tidak bersaing dengan layanan itu, jadi `data:generate` dengan Gemini dinilai aman. Alasan ini sudah dicatat di model card.
4. **Minor yang tertunda dari review akhir:** tanda minus dibuang, grounding menolak angka dari konteks, bahan kedua yang tak cocok hilang tanpa pemberitahuan.

## Saran menurunkan latensi (2026-11-09)

Uji manual menunjukkan balasan AI masih sangat lambat. Dari angka di atas, engine makan ±4,6 detik, sedangkan total permintaan 7–9 detik. Artinya ±3 detik hilang di luar LLM. Saran di bawah diurutkan dari yang paling murah dicoba. Semua bisa diuji lewat env atau perubahan kecil, lalu dibandingkan p50/p95-nya di spike.

### A. Kurangi kerja per pesan (tanpa ganti model)
1. **✅ Diterapkan: thinking Gemini dikunci ke `minimal`.** Menurut dokumentasi Google, 3.5 Flash-Lite memang memakai `minimal` secara default, tapi kini `providerOptions.google.thinkingConfig.thinkingLevel` dikirim secara eksplisit dan bisa diubah lewat `AGENT_STAGE2_THINKING_LEVEL`. Kalau latensi production tidak berubah, berarti default-nya memang sudah `minimal` dan sumber lambatnya ada di tempat lain (poin 2–6). Benchmark independen di 3.5 Flash mencatat TTFT ±1,2 detik pada `minimal` dan ±5,7 detik pada `medium`. Catatan Google: `minimal` bisa menghentikan alur tool bertahap terlalu dini, jadi cek akurasinya di spike.
2. **Kurangi jumlah langkah.** `MAX_STEPS = 5` di `stage2/agent.ts`, dan setiap panggilan tool berarti satu round-trip LLM lagi. Sebagian besar pertanyaan cukup dengan satu tool + jawaban (2 langkah). Ukur distribusi `toolNames` di trace dulu, lalu pertimbangkan batas 2–3.
3. **Lewati LLM untuk pertanyaan harga yang jelas.** Kalau classifier tahap 1 yakin intent-nya harga pasar dan komoditasnya terekstrak, panggil `harga_pasar` langsung dan jawab dengan template. Hasilnya di bawah 300 ms, dan risiko tanggal salah (temuan 1) hilang. **Butuh classifier tahap 1 dulu.**
4. **Prompt dan output lebih pendek.** Hitung token prompt sistem dan definisi tool. Karena `MAX_OUTPUT_TOKENS = 600`, balasan WhatsApp sebaiknya diminta 1–3 kalimat.

### B. Cari ±3 detik di luar LLM
5. **Samakan region Vercel Function dengan Supabase (cek ini dulu, cukup lewat dashboard).** Default Vercel adalah `iad1` (AS). Kalau Supabase di Singapura, set region `sin1` agar setiap query tidak menyeberang Pasifik. Belum diubah karena region Supabase belum diketahui (tidak ada `.env` lokal). Region bisa dilihat di dashboard Supabase → Project Settings → General, lalu diatur di Vercel → Settings → Functions → Region atau lewat `regions` di `vercel.ts`.
6. **Cek cold start dan pemuatan classifier ONNX.** Ukur waktu `loadIntentClassifier()` dan query Supabase (rate limit, trace) secara terpisah di trace. Hasilnya menentukan apakah yang perlu dibenahi model atau infrastruktur.

### C. Ganti ke penyedia yang lebih cepat (lewat env, tanpa ubah kode)
Penyedia `openai-compatible` sudah tersedia, jadi cukup isi `AGENT_STAGE2_BASE_URL`, `AGENT_STAGE2_API_KEY`, dan `AGENT_STAGE2_MODEL`.

| Opsi | Kenapa cepat | Yang perlu dicek dulu |
|---|---|---|
| **Groq** (`https://api.groq.com/openai/v1`) | Inferensi LPU, ratusan token/detik. Tier gratis tanpa kartu. | Model mana yang mendukung tool calling; batas gratis (laporan bervariasi: ±30 permintaan/menit, kuota token harian per model); apakah data dipakai untuk pelatihan. |
| **Cerebras** (`https://api.cerebras.ai/v1`) | Salah satu inferensi tercepat. | Laporan terbaru menyebut tier gratis tanpa kartu sudah ditutup (Juli 2026). Kemungkinan butuh kartu, jadi tidak cocok untuk tim. |
| **Gemini 3.5 Flash-Lite, thinking `minimal`** | Tetap di penyedia sekarang. | Lihat poin A1. |
| **`gemini-3.5-flash`** | Lebih akurat untuk tool, tapi biasanya **lebih lambat** dari Flash-Lite. | Dipakai hanya kalau akurasi bermasalah, bukan untuk mengejar kecepatan. |

Urutan uji yang disarankan: A1 → A2 → B5/B6 → Groq. Groq dianggap layak kalau spike 20 pesan menunjukkan p95 ≤ 3 detik dan ≥ 90% output valid. Semua angka batas gratis di atas berasal dari sumber pihak ketiga dan harus dicek di situs resmi penyedia sebelum dipakai.

## Prioritas (review 2026-11-09)

1. **Classifier tahap 1 belum ada.** `models/intent-classifier/` kosong, jadi `loadIntentClassifier()` mengembalikan `null` dan semua teks bebas di production berjalan sebagai "LLM saja". Dampaknya ada tiga: klaim model yang dilatih sendiri belum terbukti, latensi 7–9 detik sebagian karena setiap pesan masuk Gemini, dan metrik "panggilan LLM dihemat ≥ 60%" belum bisa diisi. Rantai `data:build` → Colab → `model:calibrate` harus jalan **10 Nov**. Kalau sampai **11 Nov** belum ada model, pakai titik potong "LLM saja" dan laporkan apa adanya.
2. **Dataset tim belum ada**, jadi semua angka di `REPORT.md` masih strip. Target sudah dikecilkan agar realistis: intent ≥ 150 (≥ 15 per intent), e2e ±30, safety ±20. Laporkan angka sebenarnya.
3. **`REPORT.md` masih menyebut Nemotron** karena hasil eval-nya dari run lama (`69d0299`). `pricing.json` dan model card sudah memakai Gemini; header laporan baru ikut berubah setelah `npm run eval` dijalankan ulang.

## Dataset `train_wa` (diimpor 2026-11-09)

Sumber: `D:\Learn ML\train_wa\pool.jsonl` dan `test.jsonl`. Formatnya sama persis dengan pipeline (9 intent yang sama, field `text`/`intent`/`source`), dan labelnya sudah dicek terhadap `intent_guidelines.md`. Tidak ditemukan konflik; pertanyaan prediksi harga dilabeli `tanya_harga_pasar`.
- 498 baris `synthetic` → `ai/data/raw/train_wa.jsonl` (±56 per intent, `di_luar_topik` 50). Lolos `npm run data:check`.
- 5 baris `team` → awal `ai/data/test.jsonl`. Satu baris `team` lain ("p") identik dengan baris sintetis sehingga dibuang.
- `data:build` dan `data:check` kini membaca semua `ai/data/raw/*.jsonl`, jadi `data:generate` (→ `synthetic.jsonl`) bersifat tambahan, bukan syarat.
- Val = 20% pool (maks. 300). Dengan `train_wa` saja: val ±11 per intent, latih ±45 per intent sebelum augmentasi. Ini cukup untuk percobaan pertama; tambah `data:generate` bila macro-F1 val rendah.
- Model atau penulis pembuat data sintetis `train_wa` belum dicatat dan perlu diisi di model card.
- `data:build` tetap menunggu `test.jsonl` mencapai ≥ 150 baris tulisan manusia.

## Pekerjaan berikutnya (urut)

1. **Spike Tugas 1 dengan Gemini:** 20 pesan × `json-text`/`native`. Tetapkan `AGENT_STAGE2_OUTPUT_MODE` (native bila ≥ 90% valid; lapor bila keduanya < 70%). Catat juga p50/p95 latensi, dan jalankan ulang untuk setiap saran latensi yang dicoba.
2. **[TIM] Dataset** (paling lambat 13 Nov):
   - `ai/data/test.jsonl` ≥ 150 baris tulisan manusia, ≥ 15 per intent (sudah ada 5 baris);
   - `ai/data/raw/team.jsonl`;
   - `evals/datasets/extract.jsonl` (±150), `e2e.json` (±30), `safety.json` (±20).
   Format: `ai/data/intent_guidelines.md`, `evals/datasets/README.md`.
3. **Classifier tahap 1:** (opsional) `npm run data:generate` → `data:build` → latih di Colab → salin artefak ke `models/intent-classifier/` → `npm run model:calibrate`. Cek ukuran < 30 MB dan p95 < 300 ms; setelah deploy, cek `.nft.json` route webhook/simulator memuat model.
4. **Eval Tugas 17:** `npm run eval` untuk `fixed-only`, `llm-only`, `router` → `npm run eval:report` → isi `evals/REPORT.md` dan `models/intent-classifier/MODEL_CARD.md`. `evals/pricing.json` sudah memuat `google/gemini-3.5-flash-lite` ($0,30 / $2,50 per 1 juta token, tier berbayar).
5. **Pipeline harga** (`ai/harga`):
   - ✅ `skema: 1`, `dibuat` dalam WIB, dan tanggal kosong menjadi `null` (bukan `"NaT"`). `prediksi.json` di repo baru ikut berubah saat pipeline dijalankan ulang.
   - ✅ Minyak goreng: tetap Rp/kg sesuai PIHPS, tanpa konversi. Prompt kini meminta satuan disebut persis dari tool.

## Yang dikerjakan fullstack di `main` (jangan disentuh dulu)
Tugas 16 (label 🤖 + `/transparansi-ai`), aturan WAF simulator, README bagian AI, halaman `/harga-pasar`. Perubahan `types.ts`/`ports.ts` tetap harus disepakati dan dikerjakan dalam commit terpisah.
