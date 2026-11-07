# GroUp

Website patungan bahan baku untuk usaha mikro. Pembeli bergabung ke batch mingguan, kuota terkumpul bersama, dan harga per unit turun mengikuti tier kuantitas.

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

- `/` — batch minggu ini dengan progres kuota dan harga bertingkat.
- `/patungan/<id>` — detail batch: tier harga, aturan pembayaran/penyerahan, dan form pesanan.
- `/pesanan` — ubah jumlah atau batalkan pesanan website memakai kode pengelolaan yang ditampilkan sekali saat pesanan dibuat.

## Aturan MVP

- Pesanan website dan WhatsApp menaikkan progres batch yang sama.
- Harga final ditetapkan dari tier kuantitas saat batch ditutup. Pesanan dibayar setelah batch mencapai minimum; batch gagal tidak ditagih.
- Admin mencatat status pembayaran dan pengambilan/pengiriman secara manual. Jadwal batch juga dibuat manual.
