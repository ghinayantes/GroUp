# Model card: classifier intent tahap 1

**Status:** belum dilatih. Artefak (`onnx/model_quantized.onnx`, `config.json`, `tokenizer*.json`, `thresholds.json`) belum ada di repo, jadi aplikasi meneruskan semua teks bebas ke tahap 2 (atau menu bila tahap 2 mati). Bagian bertanda "menunggu" diisi setelah pelatihan dan eval.

## Tujuan
Mengklasifikasi pesan WhatsApp pembeli UMKM ke salah satu dari 9 intent (`lib/agent/types.ts`) supaya pesan sederhana selesai tanpa LLM. Hanya intent dengan skor ≥ ambang per intent yang diterima; sisanya ke tahap 2.

## Model dasar
Kandidat `indobenchmark/indobert-lite-base-p1` dan `intfloat/multilingual-e5-small`, dipilih berdasarkan macro-F1 val (`ai/training/intent_classifier.ipynb`). Pilihan akhir dan tabel perbandingan: menunggu (`training_summary.json`).

## Data
- Latih: semua file `ai/data/raw/*.jsonl`, ditambah augmentasi (tukar huruf, singkatan, huruf kecil tanpa tanda baca). Hanya set latih yang diaugmentasi.
  - `train_wa.jsonl`: 498 baris sintetis (±56 per intent) dari dataset few-shot `train_wa`. Model atau penulis pembuatnya belum dicatat; isi sebelum rilis.
  - `synthetic.jsonl`: keluaran `npm run data:generate` dari model tahap 2 yang aktif (production: `google/gemini-3.5-flash-lite`). Syarat Gemini API (berlaku 23 Maret 2026) melarang memakai layanan untuk mengembangkan model yang bersaing dengan Gemini API/AI Studio. Classifier 9 intent ini bukan model bahasa umum dan tidak bersaing dengan layanan itu. Syaratnya tidak mengatur langsung pemakaian output untuk melatih model lain.
  - `team.jsonl`: tulisan tim, bila ada.
- Val: 20% pool (maks. 300 baris), dipisah sebelum augmentasi, minimal 10 per intent. Dipakai untuk kalibrasi ambang.
- Test: ≥ 150 baris tulisan manusia (≥ 15 per intent), tidak pernah dilihat saat latihan maupun kalibrasi; baris latih yang mirip (jarak edit ternormalisasi ≤ 0,15) dibuang.
- Komposisi per sumber dan per intent: menunggu (`npm run data:build`).

## Hiperparameter
`max_length` 64, `lr` 3e-5, batch 32, maks. 6 epoch dengan early stopping (macro-F1 val), seed 42. Ekspor ONNX lewat Optimum, kuantisasi int8 dinamis (AVX2).

## Kalibrasi
Ambang per intent = skor terendah dengan presisi ≥ 97% dan dukungan ≥ 5 pada val (`npm run model:calibrate`). `thresholds.json` juga memuat interval kepercayaan Wilson 95% untuk presisi itu. Val per intent hanya ±11–33 baris (tergantung besar pool), jadi batas bawah Wilson bisa jauh di bawah 97% walau presisi titiknya 100%; angka itu dilaporkan apa adanya.

## Metrik
- Val: menunggu.
- Test (`evals/REPORT.md`): menunggu.
- Ukuran file dan latensi p95 (target < 30 MB, < 300 ms): menunggu.

## Privasi tahap 2
Tahap 2 memakai tier gratis Gemini API. Menurut syaratnya, untuk layanan tidak berbayar Google memakai prompt dan respons untuk mengembangkan produknya, dan peninjau manusia bisa membacanya. Karena itu nomor telepon dan data pribadi diredaksi sebelum pesan dikirim (`lib/agent/redact.ts`). Hal yang sama wajib disebut di `/transparansi-ai`.

## Batasan yang diketahui
- Bahasa daerah yang jarang, pesan sangat panjang (dipotong di 64 token), sarkasme, dan pesan berisi beberapa maksud.
- Data latih sebagian besar sintetis; selisih presisi val dan test menandakan data latih kurang mirip pesan manusia.
- Model hanya memilih intent. Batch, jumlah, dan kode pesanan diambil ekstraktor deterministik (`lib/agent/extract.ts`).

## Penggunaan yang tidak dimaksudkan
Bukan untuk moderasi konten, analisis sentimen, atau keputusan apa pun tanpa konfirmasi tombol dari pembeli. Model tidak pernah menulis data.
