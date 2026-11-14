# Laporan evaluasi agen

Dibuat oleh `npm run eval:report` dari `evals/results/`. Commit hasil terakhir: 9e4c59a. Model tahap 2: google/gemini-3.5-flash-lite. Versi classifier: 2026-11-12-8d94f785.

## Data uji

| Dataset | Baris | Target |
|---|---|---|
| `ai/data/test.jsonl` | 225 | ≥ 150, ≥ 15 per intent, hanya tulisan manusia |

## Metrik utama (spec §1.3) — Hanya perintah baku → LLM saja → Router dua tahap

| Metrik | Target | Hanya perintah baku | LLM saja | Router dua tahap |
|---|---|---|---|---|
| Presisi tahap 1 pada pesan yang diterima (intent) | ≥ 97% | — | — | 97.6% |
| Cakupan tahap 1 (teks bebas selesai tanpa LLM) | ≥ 60% | — | — | 73.8%¹ |
| Latensi p95 tahap 1 | < 300 ms | — | — | 23.7 ms¹ |
| Akurasi intent / macro-F1 (test) | — | — | — | 89.8% / 89.8% |

"—" berarti metrik tidak berlaku untuk mode itu. ¹ Diukur dengan suite intent (`ai/data/test.jsonl`). Angka tidak dibulatkan ke atas dan ambang tidak diubah.

Harga token dicek 2026-11-09 (`evals/pricing.json`: Halaman harga Gemini API (aistudio.google.com/docs/pricing), tier Standard berbayar; katalog Vercel AI Gateway untuk model Gateway). Production memakai tier gratis, jadi biaya nyatanya $0.
