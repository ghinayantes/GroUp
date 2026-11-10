# Laporan evaluasi agen

Dibuat oleh `npm run eval:report` dari `evals/results/`. Commit hasil terakhir: 69d0299. Model tahap 2: nvidia/nemotron-3.5-lightning-free. Versi classifier: belum ada.

## Data uji yang tersedia

| Dataset | Baris | Target |
|---|---|---|
| `ai/data/test.jsonl` | 5 | ≥ 300, ≥ 25 per intent, hanya tulisan manusia |
| `evals/datasets/extract.jsonl` | belum ada | ±150 |
| `evals/datasets/e2e.json` | belum ada | ±80 skenario |
| `evals/datasets/safety.json` | belum ada | ±40 skenario |

## Metrik utama (spec §1.3) — Hanya perintah baku → LLM saja → Router dua tahap

| Metrik | Target | Hanya perintah baku | LLM saja | Router dua tahap |
|---|---|---|---|---|
| Aksi tercatat tanpa konfirmasi (e2e + safety) | 0 | — | — | — |
| Aksi end-to-end benar (e2e) | ≥ 90% | — | — | — |
| Presisi tahap 1 pada pesan yang diterima (intent) | ≥ 97% | — | — | — |
| Cakupan tahap 1 (teks bebas selesai tanpa LLM) | ≥ 60% | — | — | — |
| Panggilan LLM dihemat vs LLM saja | ≥ 60% | — | — | — |
| Latensi p95 tahap 1 | < 300 ms | — | — | — |
| Safety ditangani aman | 100% | — | — | — |
| Jawaban `answer` grounded | 100% | — | — | — |
| Akurasi intent / macro-F1 (test) | — | — | — | — |
| Panggilan LLM (e2e + safety) | — | — | — | — |
| Biaya per 1.000 pesan, perkiraan google/gemini-3.5-flash-lite | — | — | — | — |

"—" berarti metrik tidak berlaku untuk mode itu, atau datanya belum ada. Angka tidak dibulatkan ke atas dan ambang tidak diubah.

## Ekstraktor (suite extract)

Belum dijalankan: dataset belum ada.

## Suite yang dilewati

- e2e (fixed-only): evals/datasets/e2e.json belum ada atau kosong
- e2e (llm-only): evals/datasets/e2e.json belum ada atau kosong
- e2e (router): evals/datasets/e2e.json belum ada atau kosong
- extract (fixed-only): evals/datasets/extract.jsonl belum ada
- extract (llm-only): evals/datasets/extract.jsonl belum ada
- extract (router): evals/datasets/extract.jsonl belum ada
- grounding (fixed-only): evals/datasets/e2e.json dan evals/datasets/safety.json belum ada atau kosong
- grounding (llm-only): evals/datasets/e2e.json dan evals/datasets/safety.json belum ada atau kosong
- grounding (router): evals/datasets/e2e.json dan evals/datasets/safety.json belum ada atau kosong
- intent (fixed-only): ai/data/test.jsonl belum ada
- intent (llm-only): ai/data/test.jsonl belum ada
- intent (router): ai/data/test.jsonl belum ada
- safety (fixed-only): evals/datasets/safety.json belum ada atau kosong
- safety (llm-only): evals/datasets/safety.json belum ada atau kosong
- safety (router): evals/datasets/safety.json belum ada atau kosong

Harga token dicek 2026-11-09 (`evals/pricing.json`: Halaman harga Gemini API (aistudio.google.com/docs/pricing), tier Standard berbayar; katalog Vercel AI Gateway untuk model Gateway). Production memakai tier gratis, jadi biaya nyatanya $0; kolom biaya di atas adalah perkiraan bila memakai google/gemini-3.5-flash-lite di tier berbayar.
