# Model card: classifier intent tahap 1

**Status:** dilatih 12 Nov 2026, versi `2026-11-12-8d94f785` (`thresholds.json`). Pesan yang skornya di bawah ambang tetap diteruskan ke tahap 2.

## Tujuan
Mengklasifikasi pesan WhatsApp pembeli UMKM ke salah satu dari 9 intent (`lib/agent/types.ts`) supaya pesan sederhana selesai tanpa LLM. Hanya intent dengan skor ≥ ambang per intent yang diterima; sisanya ke tahap 2.

## Model dasar
Kandidat `indobenchmark/indobert-lite-base-p1` dan `intfloat/multilingual-e5-small` (`ai/training/intent_classifier.ipynb`). Dipilih **IndoBERT-lite** (11,7 jt parameter).

| Kandidat | macro-F1 val | Ukuran int8 | Catatan |
|---|---|---|---|
| `intfloat/multilingual-e5-small` | 0,9767 | > 100 MB | Ditolak: melebihi batas 30 MB. Diukur di Colab T4 pada data 9.073 baris (sebelum data tambahan). |
| `indobenchmark/indobert-lite-base-p1` | 1,0000 | 12,2 MB | Dipakai. Dilatih ulang di RTX 4060 Laptop (6,4 menit, berhenti di epoch 3). |

Tokenizer IndoBERT-lite dimuat dengan `BertTokenizerFast` karena config-nya ALBERT tetapi kosakatanya WordPiece.

## Data
- Latih: semua file `ai/data/raw/*.jsonl`, ditambah augmentasi (tukar huruf, singkatan, huruf kecil tanpa tanda baca). Hanya set latih yang diaugmentasi.
  - `synthetic.jsonl`: keluaran `npm run data:generate` dari model tahap 2 yang aktif (production: `google/gemini-3.5-flash-lite`). Syarat Gemini API (berlaku 23 Maret 2026) melarang memakai layanan untuk mengembangkan model yang bersaing dengan Gemini API/AI Studio. Classifier 9 intent ini bukan model bahasa umum dan tidak bersaing dengan layanan itu. Syaratnya tidak mengatur langsung pemakaian output untuk melatih model lain.
  - `train_wa.jsonl`: 10.001 baris sintetis berpola dari rekan tim (`cd28e5a`). Sebagian besar membungkus pesan tim dengan sapaan atau penutup ("Izin ya min, … ya").
  - `team.jsonl`: 275 baris tulisan tim (±31 per intent), sisa dari pool tim `train_wa` setelah 25 per intent diambil untuk test (seed 42). Field `source` di file asalnya tertulis `synthetic`; menurut pemilik proyek seluruh pool ditulis tim, jadi dilabeli ulang `team`. 3 baris yang identik dengan `synthetic.jsonl` dibuang.
- Val: 20% pool (maks. 300 baris), dipisah sebelum augmentasi, minimal 10 per intent. Dipakai untuk kalibrasi ambang.
- Test: 225 baris tulisan tim (25 per intent) dari pool yang sama dengan `team.jsonl`, tidak pernah dilihat saat latihan maupun kalibrasi. Baris latih dibuang bila mirip test (jarak edit ternormalisasi ≤ 0,15) **atau memuat utuh teks test berisi ≥ 3 kata**; varian augmentasi juga disaring. Tanpa aturan kedua, 221 dari 225 pesan test muncul terbungkus di `train_wa.jsonl` dan akurasi test palsu 100%.
- Komposisi setelah `npm run data:build` (12 Nov 2026): train 61.851 baris setelah augmentasi (±6.000–7.700 per intent), val 301 (29–37 per intent), test 225. 283 duplikat lintas file dilebur dan 4.100 baris latih dibuang karena mirip atau memuat test.

## Hiperparameter
`max_length` 64, `lr` 3e-5, batch 32, maks. 6 epoch dengan early stopping (macro-F1 val), seed 42. Ekspor ONNX lewat Optimum. Node `Identity` untuk bobot ALBERT yang dipakai bersama disambung langsung ke initializer, lalu kuantisasi int8 dinamis ONNX Runtime untuk `MatMul`, `Gemm`, dan `Gather` (tanpa langkah ini file 40,6 MB). Akurasi val fp32 1,0000, int8 0,9967.

## Kalibrasi
Ambang per intent = skor terendah dengan presisi ≥ 97% dan dukungan ≥ 5 pada val (`npm run model:calibrate`). `thresholds.json` juga memuat interval kepercayaan Wilson 95% untuk presisi itu. Val per intent hanya ±11–33 baris (tergantung besar pool), jadi batas bawah Wilson bisa jauh di bawah 97% walau presisi titiknya 100%; angka itu dilaporkan apa adanya.

## Metrik
- Val (301 baris, sebagian besar sintetis): macro-F1 1,0000. Terlalu mudah, jadi tidak dipakai sebagai klaim.
- **Test (225 pesan tim, `evals/results/2026-11-12-intent-router.json`)**:

  | Metrik | Nilai |
  |---|---|
  | Akurasi semua tebakan | 89,8% |
  | Macro-F1 | 0,898 |
  | Presisi pesan yang diterima tahap 1 | 97,6% (162 dari 166) |
  | Pesan yang diterima tahap 1 (tanpa LLM) | 73,8% |
  | Presisi terendah per intent | `tanya_info` 86,7% (13/15), `catat_minat` 90,5% (19/21) |

- Ukuran `model_quantized.onnx` 12,2 MB. Latensi klasifikasi di laptop (CPU, setelah pemanasan) p50 4,8 ms, p95 23,7 ms.
- Fungsi Vercel agen ±82 MB di linux (101 MB terukur di Windows): hanya binary `onnxruntime-node` platform build yang di-trace (`next.config.ts`).

## Privasi tahap 2
Tahap 2 memakai tier gratis Gemini API. Menurut syaratnya, untuk layanan tidak berbayar Google memakai prompt dan respons untuk mengembangkan produknya, dan peninjau manusia bisa membacanya. Karena itu nomor telepon dan data pribadi diredaksi sebelum pesan dikirim (`lib/agent/redact.ts`). Hal yang sama wajib disebut di `/transparansi-ai`.

## Batasan yang diketahui
- Bahasa daerah yang jarang, pesan sangat panjang (dipotong di 64 token), sarkasme, dan pesan berisi beberapa maksud.
- Data latih sebagian besar sintetis; selisih presisi val dan test menandakan data latih kurang mirip pesan manusia.
- Test dan `team.jsonl` ditulis oleh tim yang sama dalam satu pool, sehingga gaya tulisannya mirip. Pemisahan hanya membuang baris yang hampir identik (jarak edit ≤ 0,15), jadi angka test kemungkinan lebih tinggi daripada pada chat pelanggan asli.
- Model hanya memilih intent. Batch, jumlah, dan kode pesanan diambil ekstraktor deterministik (`lib/agent/extract.ts`).

## Penggunaan yang tidak dimaksudkan
Bukan untuk moderasi konten, analisis sentimen, atau keputusan apa pun tanpa konfirmasi tombol dari pembeli. Model tidak pernah menulis data.
