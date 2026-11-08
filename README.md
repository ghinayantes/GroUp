# GroUp

Website patungan bahan baku untuk usaha mikro. Pembeli bisa bergabung lewat website atau WhatsApp; kedua jalur menyimpan pesanan ke tabel yang sama. WhatsApp memakai engine agen di `lib/agent/`.

## Menjalankan website

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`. Tanpa kredensial, website tetap menampilkan batch contoh untuk pratinjau; pemesanan tersimpan baru tersedia setelah Supabase disiapkan.

## Supabase

1. Buat proyek Supabase dan buat file lokal `.env.local` di root proyek.
2. Isi `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, dan `SUPABASE_SECRET_KEY`. Jangan pernah menaruh secret key di variabel `NEXT_PUBLIC_` atau di browser.
3. Terapkan file di `supabase/migrations/` secara berurutan melalui Supabase SQL Editor atau `supabase db push`.
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

## Aturan MVP

- Pesanan website dan WhatsApp menaikkan progres batch yang sama.
- Harga final ditetapkan dari tier kuantitas saat batch ditutup. Pesanan dibayar setelah batch mencapai minimum; batch gagal tidak ditagih.
- Admin mencatat status pembayaran dan pengambilan/pengiriman secara manual. Jadwal batch juga dibuat manual.
