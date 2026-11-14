# Evaluasi agen

Folder ini menjawab satu pertanyaan: **seberapa bisa agen chat GroUp dipercaya?** Setiap klaim di README utama dan halaman `/transparansi-ai` berasal dari hasil di sini, tidak dibulatkan ke atas, dan ambangnya tidak diubah setelah melihat hasil.

Hasil terbaru: **[REPORT.md](REPORT.md)**.

## Hasil saat ini

Diukur pada 225 pesan uji tulisan tim (`ai/data/test.jsonl`) yang tidak pernah dipakai untuk latihan.

| Metrik | Target | Hasil |
|---|---|---|
| Presisi tahap 1 pada pesan yang diterima | ≥ 97% | **97,6%** ✅ |
| Teks bebas selesai tanpa LLM | ≥ 60% | **73,8%** ✅ |
| Latensi p95 tahap 1 | < 300 ms | **23,7 ms** ✅ |
| Akurasi intent / macro-F1 | — | 89,8% / 0,898 |

Suite `extract`, `e2e`, dan `safety` sudah siap dijalankan, tetapi datasetnya belum ditulis tim. Laporan menandainya "belum ada" alih-alih mengisi angka.

## Tiga mode, satu perbandingan

Setiap suite bisa dijalankan dalam tiga mode supaya nilai tambah router dua tahap terlihat jelas:

| Mode | Isi | Gunanya |
|---|---|---|
| `fixed-only` | Hanya perintah baku, tanpa AI | Batas bawah: apa yang bisa dilakukan bot biasa |
| `llm-only` | Semua teks bebas langsung ke LLM | Pembanding biaya dan kualitas |
| `router` | Perintah baku → classifier lokal → LLM | Konfigurasi production |

## Suite

| Suite | Dataset | Yang diukur |
|---|---|---|
| `intent` | `ai/data/test.jsonl` | Akurasi, macro-F1, confusion matrix, presisi dan cakupan tahap 1, latensi |
| `extract` | `datasets/extract.jsonl` | Ekstraksi batch, jumlah, satuan, dan pesanan yang dimaksud |
| `e2e` | `datasets/e2e.json` | Percakapan lengkap sampai data akhir di database sesuai harapan |
| `safety` | `datasets/safety.json` | Injection, data orang lain, jumlah ekstrem, dan pesan di luar topik tidak menulis data |
| `grounding` | `e2e.json` + `safety.json` | Angka di jawaban LLM benar-benar ada di hasil tool |

Metrik terpenting adalah **aksi tercatat tanpa konfirmasi** dengan target **0**. Data yang tertulis pada giliran yang bukan tombol konfirmasi dihitung sebagai pelanggaran. Format dataset ada di [`datasets/README.md`](datasets/README.md).

## Menjalankan

```bash
npm run eval -- --mode router                    # semua suite, mode production
npm run eval -- --suite intent --mode router     # satu suite
npm run eval -- --mode llm-only --refresh        # abaikan cache LLM
npm run eval:report                              # tulis ulang REPORT.md
```

Mode `llm-only` dan `router` butuh penyedia tahap 2 di `.env.local` (lihat bagian "Agen AI" di README utama). Mode `fixed-only` dan suite `intent` tanpa LLM bisa jalan tanpa kunci apa pun.

## Isi folder

| File | Isi |
|---|---|
| `run.ts` | Menjalankan suite dan menyimpan hasil ke `results/<tanggal>-<suite>-<mode>.json` |
| `suites.ts` | Logika tiap suite |
| `scenario.ts` | Menjalankan skenario percakapan di engine asli dengan penyimpanan di memori |
| `metrics.ts` | Akurasi, macro-F1, confusion matrix, persentil, biaya per 1.000 pesan |
| `cache.ts` | Cache jawaban LLM per input, jadi eval ulang tidak memanggil model lagi |
| `report.ts`, `summary.ts` | Menyusun `REPORT.md` dari hasil eval |
| `pricing.json` | Harga token per model untuk perkiraan biaya (dicek 9 Nov 2026) |
| `datasets/` | Dataset eval tulisan tim |
| `results/` | Hasil mentah setiap run (JSON), di-commit agar bisa diaudit |

Production memakai tier gratis Gemini, jadi biaya nyatanya $0. Kolom biaya di laporan adalah perkiraan bila memakai tier berbayar.
