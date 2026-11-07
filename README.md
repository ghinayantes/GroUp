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

## Halaman pembeli

- `/` — batch minggu ini dengan progres kuota dan harga bertingkat.
- `/patungan/<id>` — detail batch: tier harga, aturan pembayaran/penyerahan, dan form pesanan.
- `/pesanan` — ubah jumlah atau batalkan pesanan website memakai kode pengelolaan yang ditampilkan sekali saat pesanan dibuat.

## Aturan MVP

- Harga final ditetapkan dari tier kuantitas saat batch ditutup. Pesanan dibayar setelah batch mencapai minimum; batch gagal tidak ditagih.
