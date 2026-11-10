# GroUp

Website patungan bahan baku untuk usaha mikro. Pembeli bisa bergabung lewat website, WhatsApp, atau simulator WhatsApp di website; ketiga jalur menyimpan pesanan ke tabel yang sama. WhatsApp dan simulator memakai engine agen yang sama (`lib/agent/`). Pemahaman teks bebas dengan AI sedang dikerjakan; saat ini teks bebas dibalas menu.

## Menjalankan website

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`. Tanpa kredensial, website tetap menampilkan batch contoh untuk pratinjau; pemesanan tersimpan baru tersedia setelah Supabase disiapkan.

## Supabase

1. Buat proyek Supabase dan buat file lokal `.env.local` di root proyek.
2. Isi `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, dan `SUPABASE_SECRET_KEY`. Jangan pernah menaruh secret key di variabel `NEXT_PUBLIC_` atau di browser.
3. Terapkan semua file di `supabase/migrations/` secara berurutan (`20261030165820_create_patungan_ordering.sql`, `20261103090000_align_with_design.sql`, lalu `20261106090000_agent_router.sql`, dan `20261112090000_storage_buckets.sql`) melalui Supabase SQL Editor atau `supabase db push`. Migrasi ketiga menambah kanal `simulator`, tabel agen (`agent_messages`, `agent_traces`, `demand_interests`) beserta kolom `channel` dan `pending_action` di `whatsapp_sessions`, batas 50 pesanan simulator aktif per batch, serta fungsi `purge_simulator_orders` dan `cleanup_agent_data`. Migrasi `20261112090000_storage_buckets.sql` membuat bucket `batch-images` dan `site-media`; foto batch diupload ke bucket `batch-images`.
4. Aktifkan Email/Password di Supabase Auth dan buat akun admin. Di SQL Editor proyek sendiri, set peran server-side untuk email admin (ganti alamatnya):

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where email = 'admin@contoh.id';
   ```

   Jangan gunakan `user_metadata` sebagai sumber otorisasi. Keluar lalu masuk kembali agar token sesi memuat peran baru.
5. Masuk di `/admin/login`. Di dasbor admin:
   - tambah supplier lalu tandai terverifikasi setelah pemeriksaan manual (beserta catatan);
   - buka batch dengan kuota minimum, 1–6 tier harga bertingkat, deadline, aturan pembayaran, dan rencana penyerahan;
   - pantau progres dan daftar pesanan (website + WhatsApp) per batch;
   - tutup batch setelah deadline: di bawah minimum → *tidak tercapai* tanpa tagihan; mencapai minimum → harga final dibekukan dan pesanan berstatus *menunggu bayar*;
   - catat status pembayaran dan penyerahan per pesanan secara manual.

Integrasi pembayaran dan logistik belum disiapkan.

## Halaman pembeli

Semua halaman publik berada di `app/(site)/` dan memakai header (pencarian + kategori) serta footer yang sama.

- `/` — beranda: hero, kategori, banner informasi, batch minggu ini, hitung mundur batch terdekat.
- `/patungan` — katalog semua batch terbuka dengan pencarian, filter (kategori, hampir capai kuota, tutup ≤ 3 hari, supplier terverifikasi), dan urutan. Filter tersimpan di URL, misalnya `/patungan?kategori=sayuran&sort=progres`.
- `/patungan/<id>` — detail batch: tier harga, aturan pembayaran/penyerahan, riwayat batch selesai supplier, dan form pesanan.
- `/kategori` dan `/kategori/<slug>` — daftar kategori dan katalog per kategori.
- `/cara-kerja` — alur patungan, simulasi harga bertingkat, perintah WhatsApp, dan FAQ.
- `/supplier` — informasi dan pendaftaran mitra supplier lewat email.
- `/pesanan` — ubah jumlah atau batalkan pesanan website memakai kode pengelolaan yang ditampilkan sekali saat pesanan dibuat.

## WhatsApp Cloud API

Isi server-side `WHATSAPP_API_VERSION` (format `vNN.N`), `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, dan `WHATSAPP_APP_SECRET`. Opsional, isi `NEXT_PUBLIC_WHATSAPP_NUMBER` (kode negara dan angka saja) agar website menampilkan tautan WhatsApp.

Daftarkan callback Meta ke `https://<domain-publik>/api/whatsapp/webhook`, masukkan verify token yang sama, lalu subscribe ke event `messages`. Webhook harus menggunakan HTTPS yang dapat dijangkau Meta. Pengembangan lokal dapat memakai tunnel HTTPS. Pembeli mengirim `MULAI`, memilih batch, membaca aturan batch, memasukkan jumlah, lalu mengonfirmasi. `PESANAN` menampilkan pesanan aktif dari nomor yang sama, `UBAH <kode> <jumlah>` mengubah jumlah, dan `BATAL <kode>` membatalkan selama batch masih terbuka. `UBAH` dan `BATAL` kini menampilkan tombol konfirmasi dulu; perubahan baru disimpan setelah pembeli menekan tombol. `BATAL` tanpa kode menutup pertanyaan yang sedang berjalan. Webhook memverifikasi signature, mengabaikan ID pesan duplikat, dan memproses pesan setelah respons dikirim (`after()`).

## Simulator WhatsApp

Buka `/simulator` (tautan "Coba simulator" di header dan footer). Simulator memanggil `POST /api/simulator/message` dan memakai engine yang sama dengan webhook WhatsApp, jadi alurnya identik: kirim `MULAI`, tekan "Pilih batch", pilih baris, isi jumlah, lalu tekan "Ya, ikut". Panel "Di balik layar" menampilkan tahap, intent, keyakinan, slot, tool, latensi, dan token tiap pesan.

- Identitas pengunjung disimpan di cookie `sim_session` (httpOnly, 7 hari). Pesanan tercatat dengan kanal `simulator` dan nama usaha yang diisi pengunjung di atas chat (wajib, 2–80 karakter, disimpan di `localStorage` browser), setara nama profil WhatsApp.
- Paling banyak 50 pesanan simulator aktif per batch. Pengelola bisa menghapus semua pesanan simulator di batch terbuka lewat tombol "Hapus pesanan simulator" di dasbor admin (`DELETE /api/admin/simulator-orders`).
- Endpoint simulator publik. Sebelum demo, pasang rate limit Vercel WAF 30 permintaan per menit per IP (butuh `vercel link`):

  ```bash
  vercel firewall rules add "Rate limit simulator" \
    --condition '{"type":"path","op":"eq","value":"/api/simulator/message"}' \
    --action rate_limit \
    --rate-limit-window 60 \
    --rate-limit-requests 30 \
    --rate-limit-keys ip \
    --rate-limit-action deny --yes
  vercel firewall diff
  vercel firewall publish --yes
  ```

## Agen AI

Teks bebas dari WhatsApp dan simulator diproses tiga lapis:

1. **Perintah baku** (`MULAI`, `PESANAN`, `UBAH`, `BATAL`, tombol) tanpa AI.
2. **Tahap 1:** classifier intent lokal (ONNX, `models/intent-classifier/`). Selama artefak model belum ada, lapis ini dilewati.
3. **Tahap 2:** model bahasa dengan tools baca-saja (`cari_batch`, `detail_batch`, `pesanan_saya`, `harga_pasar`). Teks dan riwayat diredaksi dulu (nomor telepon, email, deret angka panjang), angka di jawaban harus ada di hasil tool, dan setiap pengirim dibatasi 20 panggilan per jam (panggilan yang gagal ikut dihitung).

Setiap aksi yang mengubah data tetap butuh tombol konfirmasi. Balasan AI diberi awalan 🤖, dan balasan AI pertama dalam 24 jam menautkan `/transparansi-ai`.

Harga pasar dibaca dari `ai/harga/output/prediksi.json` (PIHPS Kota Bandung, bulanan). Untuk memperbarui: jalankan pipeline di `ai/harga/` (lihat README di sana), commit `prediksi.json`, lalu push.

### Penyedia model tahap 2

| Nama | Keterangan |
|---|---|
| `AGENT_STAGE2_PROVIDER` | `gateway` (default, Vercel AI Gateway; butuh kartu kredit terdaftar di akun Vercel), `google` (Gemini), atau `openai-compatible` |
| `AGENT_STAGE2_MODEL` | ID model. Kosong → `nvidia/nemotron-3.5-lightning-free` untuk `gateway`, `gemini-3.5-flash-lite` untuk `google`. Wajib untuk `openai-compatible` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Kunci Gemini dari https://aistudio.google.com/apikey |
| `AI_GATEWAY_API_KEY` | Kunci AI Gateway untuk lokal (di Vercel cukup OIDC) |
| `AGENT_STAGE2_BASE_URL`, `AGENT_STAGE2_API_KEY` | Endpoint kompatibel OpenAI, misalnya OpenCode Zen `https://opencode.ai/zen/v1`, OpenRouter, atau NVIDIA NIM |
| `AGENT_STAGE2_OUTPUT_MODE` | `json-text` (default) atau `native` (output terstruktur) |

Konfigurasi yang tidak lengkap mematikan tahap 2 dengan peringatan di log; teks bebas dibalas menu. Production saat ini memakai `google`.

### Dataset, pelatihan, dan eval

```bash
npm run data:check          # validasi format dataset intent
npm run data:generate       # data sintetis lewat penyedia tahap 2 di atas
npm run data:build          # split train/val/test
npm run model:calibrate     # ambang per intent dari val → models/intent-classifier/thresholds.json
npm run eval -- --mode router   # juga: --mode fixed-only, --mode llm-only, --suite <nama>
npm run eval:report         # tulis evals/REPORT.md
```

Pelatihan dijalankan di Colab (`ai/training/intent_classifier.ipynb`). Format dataset: `ai/data/intent_guidelines.md` dan `evals/datasets/README.md`. Hasil eval: `evals/REPORT.md`; model card: `models/intent-classifier/MODEL_CARD.md`.

## Pembersihan data agen

`vercel.ts` mendaftarkan Vercel Schedule `agent-cleanup` setiap hari pukul 02.00 WIB yang memanggil `GET /api/cron/cleanup`. Endpoint ini menolak permintaan tanpa header `Authorization: Bearer <CRON_SECRET>`, lalu menjalankan `cleanup_agent_data`: riwayat pesan dan ID pesan masuk dihapus setelah 30 hari, trace setelah 90 hari, dan sesi yang kedaluwarsa. Schedule hanya berjalan di deployment production. Untuk menjalankannya manual:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/cleanup
```

## Variabel lingkungan tambahan

| Nama | Keterangan |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | URL publik situs, dipakai di tautan balasan agen. Di Vercel jatuh ke `VERCEL_PROJECT_PRODUCTION_URL` bila kosong |
| `CRON_SECRET` | String acak ≥ 16 karakter (huruf dan angka) untuk endpoint pembersihan |
| `AGENT_ENABLED` | `false` mematikan pemahaman teks bebas; teks bebas hanya dibalas menu (sakelar darurat) |

## Tes

```bash
npm test                 # Vitest + pytest pipeline harga (SKIP_PYTEST=1 untuk melewati pytest)
npx tsc --noEmit && npm run lint && npm run build
supabase start && supabase db reset && supabase test db   # tes pgTAP, butuh Docker + Supabase CLI
```

## Aturan MVP

- Pesanan website dan WhatsApp menaikkan progres batch yang sama.
- Harga final ditetapkan dari tier kuantitas saat admin menutup batch. Pesanan dibayar setelah batch mencapai minimum; batch gagal tidak ditagih.
- Admin mencatat status pembayaran dan pengambilan/pengiriman secara manual. Jadwal batch juga dibuat manual.
- Pemrosesan pembayaran dan pengaturan logistik belum aktif.
