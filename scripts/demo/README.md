# Skrip demo

Tiga skrip agar juri bisa mencoba GroUp dari tiga sudut pandang tanpa perlu membuat data sendiri, plus rekaman video yang menunjukkan alur sebenarnya.

| Perintah | Hasil | Butuh |
|---|---|---|
| `npm run demo:seed` | Akun demo dan data contoh yang realistis | `.env.local` berisi Supabase + akun `DEMO_*` |
| `npm run demo:record` | Video hero halaman depan (MP4 + poster) | `ffmpeg`, Playwright Chromium, server berjalan |
| `npm run demo:clips` | Tiga klip simulator di `public/demo/` | Playwright, situs yang bisa dibuka |

## `demo:seed`: isi data demo

```bash
npm run demo:seed                  # idempoten, aman dijalankan berulang
npm run demo:seed -- --tanpa-llm   # trace simulasi tanpa memanggil LLM tahap 2
```

Yang dibuat:

- **3 akun demo**: pembeli, grosir, dan admin. Di `/masuk`, tombol "Coba sebagai …" langsung login tanpa mengetik kata sandi.
- **Supplier "Grosir Demo"**, terverifikasi dan dimiliki akun grosir demo.
- **8 batch bahan pokok** dengan foto dari `images/`, mencakup semua status: 4 terbuka, 3 berhasil (menunggu bayar, siap diambil, sudah diambil), dan 1 tidak tercapai.
- **Pesanan pembeli demo** di batch-batch tersebut, sehingga timeline kuota → bayar → serah langsung terlihat di `/akun`.
- **±36 minat permintaan** dari 15 pengirim fiktif untuk radar permintaan grosir.
- **±200 trace agen** dari skenario simulator untuk halaman Aktivitas AI admin.

Harga batch dihitung dari harga PIHPS terakhir (`ai/harga/output/prediksi.json`) dikali persentase tier per komoditas (`TIER_PCT` di `plan.ts`). Hasilnya hemat 3–12%, sesuai margin distribusi BPS, bukan diskon yang tidak masuk akal. Tabel lengkapnya ada di bagian "Coba sebagai juri" README utama.

Data demo kembali ke keadaan awal setiap malam lewat `reset_demo_data()`.

## `demo:record`: video halaman depan

```bash
npm run build && npm start   # terminal lain
npm run demo:record          # DEMO_BASE_URL bawaan http://localhost:3000
```

Rekaman ±60–75 detik dalam empat adegan:

1. **Simulator**: pesan bebas menghasilkan tombol konfirmasi, lalu pertanyaan harga dijawab dari data PIHPS.
2. **Detail batch**: badge hemat dan kartu kepercayaan supplier.
3. **Grosir**: radar permintaan, lalu buka batch dengan asisten harga dan upload foto.
4. **Admin**: Aktivitas AI.

Video dikonversi ke MP4 (H.264, `+faststart`) dan poster JPG, diunggah ke bucket `site-media`, lalu skrip mencetak nilai `NEXT_PUBLIC_DEMO_VIDEO_URL` dan `NEXT_PUBLIC_DEMO_POSTER_URL`. Langkah yang gagal menghentikan rekaman, jadi skrip ini sekaligus uji asap end-to-end.

## `demo:clips`: tiga klip simulator

```bash
npm run demo:clips -- --base https://gro-up-virid.vercel.app --channel msedge
npm run demo:clips -- --only harga-pasar   # satu klip saja
```

| Klip | Yang ditunjukkan | Disimpan hanya bila |
|---|---|---|
| `ikut-batch` | Pesan bebas → tombol "Ya, ikut" | Tombol konfirmasi muncul |
| `harga-pasar` | Pertanyaan harga → jawaban dari PIHPS | Jawaban menyebut PIHPS dan rupiah |
| `tolak-manipulasi` | Perintah manipulatif → dialihkan ke menu | Balasan tanpa tombol aksi dan tidak menjanjikan "gratis" |

Klip yang tidak sesuai harapan direkam ulang sampai tiga kali. Hasilnya (WebM, poster JPG, caption VTT) disimpan di `public/demo/`, dan waktu tiap langkah agen ditulis ke `lib/demo-clips.json` agar panel di halaman depan menyala tepat waktu. Skenario dan teksnya ada di `lib/demo-clips.ts`.

## Isi folder

| File | Isi |
|---|---|
| `seed.ts` | Membuat akun, supplier, batch, pesanan, minat, dan trace |
| `plan.ts` | Rencana data demo: 8 batch, persen tier, jumlah pengisi kuota (diuji di `plan.test.ts`) |
| `record.ts` | Rekaman video hero |
| `clips.ts` | Rekaman klip simulator |
| `images/` | Foto 8 bahan, diunggah ke bucket `batch-images` saat seed |
