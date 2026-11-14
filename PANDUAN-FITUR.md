# Panduan Fitur dan Cara Tes GroUp

Dokumen ini menjelaskan setiap fitur GroUp dan cara mengujinya, baik secara manual di browser maupun dengan tes otomatis. Untuk instalasi dan konfigurasi, lihat [README](README.md).

- **Production:** https://gro-up-virid.vercel.app
- **Lokal:** `npm run dev`, lalu buka http://localhost:3000

## Persiapan

### Data demo

Jalankan sekali (atau kapan saja untuk mengembalikan data ke awal):

```bash
npm run demo:seed
```

Isinya:

| Data | Jumlah | Keterangan |
|---|---|---|
| Akun demo | 3 | Pembeli, grosir, admin (`DEMO_*` di `.env.local`) |
| Supplier | 1 | "Grosir Demo", terverifikasi, milik akun grosir demo |
| Batch | 8 | 4 terbuka, 3 berhasil, 1 tidak tercapai, masing-masing dengan foto bahan |
| Pesanan | 33 | Termasuk pesanan milik pembeli demo di berbagai status |
| Minat permintaan | 36 | Dari 15 pengirim fiktif, untuk radar grosir |
| Trace agen | ±200 | Untuk halaman Aktivitas AI admin |

Harga tier batch demo mengikuti harga PIHPS Kota Bandung, dengan hemat 3–12% sesuai margin distribusi tiap komoditas.

| Batch | Status |
|---|---|
| Cabai Merah Keriting, Bawang Merah, Telur Ayam Ras, Daging Ayam Ras | Terbuka |
| Beras Medium | Berhasil, menunggu bayar |
| Gula Pasir | Berhasil, siap diambil |
| Minyak Goreng Curah | Berhasil, sudah diambil |
| Bawang Putih | Tidak tercapai |

Data demo dikembalikan ke keadaan awal setiap malam (02.00 WIB) oleh cron pembersihan.

### Masuk sebagai akun demo

Buka `/masuk`, lalu klik **Coba sebagai Pembeli**, **Coba sebagai Grosir**, atau **Coba sebagai Admin**. Tidak perlu mengetik kata sandi.

> Di production, tombol ini butuh `DEMO_*` di Environment Variables Vercel dan redeploy setelah env ditambahkan.

---

## 1. Halaman publik (tanpa login)

### Beranda `/`
**Isinya:** hero, perbandingan harga pasar vs patungan, tiga manfaat AI, simulator, strip metrik eval, tombol "Coba sebagai …", kategori, batch minggu ini, hitung mundur batch terdekat.

**Cara tes:**
1. Buka `/`.
2. Bagian **Harga pasar vs harga patungan** menampilkan batch terbuka dengan label "Hemat X% vs pasar" dan sumber PIHPS.
3. Bagian **Batch minggu ini** menampilkan kartu batch lengkap dengan foto, progres kuota, dan harga tier.

**Hasil yang benar:** angka hemat masuk akal (sekitar 3–12%), bukan puluhan persen. Semua foto tampil.

### Katalog patungan `/patungan`
**Isinya:** semua batch terbuka, dengan pencarian, filter, dan urutan.

**Cara tes:**
1. Ketik "cabai" di kolom pencarian. Yang tersisa hanya Cabai Merah Keriting.
2. Pilih kategori **Protein**. Yang tersisa Telur dan Daging Ayam.
3. Centang **Hampir capai kuota (≥ 80%)**. Hanya batch dengan progres ≥ 80% yang tampil.
4. Ganti **Urutkan**, lalu lihat URL berubah, misalnya `?kategori=protein&sort=progres`.
5. Muat ulang halaman. Filter tetap sama karena disimpan di URL.

### Detail batch `/patungan/<id>`
**Isinya:** tier harga, cek harga wajar, kartu kepercayaan supplier, aturan pembayaran dan penyerahan, form pesanan.

**Cara tes (pesan tanpa login):**
1. Buka salah satu batch terbuka.
2. Isi nama usaha, nomor WhatsApp, dan jumlah, lalu kirim.
3. Muncul **kode pengelolaan**. Catat, karena hanya ditampilkan sekali.
4. Progres kuota batch bertambah sesuai jumlah pesanan.

### Kelola pesanan `/pesanan`
**Cara tes:**
1. Masukkan kode pengelolaan dari langkah sebelumnya.
2. Ubah jumlah. Progres batch ikut berubah.
3. Batalkan pesanan. Progres batch berkurang lagi.

### Halaman lain
| Rute | Yang dicek |
|---|---|
| `/kategori`, `/kategori/<slug>` | Daftar kategori dan batch per kategori |
| `/cara-kerja` | Alur patungan, simulasi harga bertingkat, perintah WhatsApp, FAQ |
| `/supplier` | Informasi mitra dan tautan pendaftaran lewat email |
| `/transparansi-ai` | Penjelasan kapan dan bagaimana AI dipakai |

---

## 2. Simulator WhatsApp `/simulator`

**Isinya:** chat yang memakai engine agen yang sama dengan WhatsApp asli, plus panel **Di balik layar** (jalur, alasan, guard, intent, tool, latensi, token).

**Cara tes alur pesan:**
1. Isi **Nama usaha**, misalnya "Warung Uji".
2. Kirim `MULAI`, tekan **Pilih batch**, lalu pilih satu batch.
3. Isi jumlah, lalu tekan **Ya, ikut**.
4. Kirim `PESANAN`. Pesanan yang baru dibuat muncul dengan kodenya.
5. Kirim `UBAH <kode> <jumlah>`. Muncul tombol konfirmasi dulu, dan jumlah baru tersimpan setelah ditekan.
6. Kirim `BATAL <kode>`, lalu konfirmasi.

**Cara tes AI:**
1. Kirim pertanyaan bebas, misalnya "harga cabai berapa?" atau "mau ikut cabe 5 kilo".
2. Balasan AI diawali 🤖, dan balasan AI pertama menautkan `/transparansi-ai`.
3. Untuk "mau ikut cabe 5 kilo", AI **tidak langsung membuat pesanan**. Selalu ada tombol konfirmasi dulu.
4. Buka panel **Di balik layar** untuk melihat tahap, intent, dan tool yang dipakai.

**Batasan yang bisa dicek:** maksimal 50 pesanan simulator aktif per batch. Admin bisa menghapus semuanya lewat tombol **Hapus pesanan simulator**.

---

## 3. Dashboard pembeli `/akun`

Masuk dengan **Coba sebagai Pembeli**.

| Fitur | Cara tes | Hasil yang benar |
|---|---|---|
| Ringkasan | Buka `/akun` | Total pesanan dan total hemat dibanding harga pasar |
| Pesanan saya | Buka `/akun/pesanan` | Pesanan di berbagai status dengan timeline kuota → pembayaran → penyerahan |
| Ubah/batal | Ubah jumlah pesanan di batch terbuka | Tersimpan; pesanan di batch tertutup tidak bisa diubah |
| Pesanan otomatis tercatat | Pesan dari halaman batch saat masih login | Pesanan langsung muncul di `/akun/pesanan` |

---

## 4. Dashboard grosir `/grosir`

Masuk dengan **Coba sebagai Grosir**.

| Fitur | Rute | Cara tes |
|---|---|---|
| Ringkasan | `/grosir` | Progres kuota batch milik Grosir Demo |
| Batch saya | `/grosir/batch` | Daftar batch; batch terbuka bisa ditutup |
| Radar permintaan | `/grosir/radar` | Bahan yang banyak dicari UMKM, kuantitas mingguan, tren 14 hari, harga pasar. Bahan dengan kurang dari 2 pengirim tidak muncul |
| Buka batch | `/grosir/buka-batch` | Isi bahan, upload foto, lalu lihat **asisten harga**: saran tier 95% dan 90% harga pasar dan kuota minimum dari radar |
| Profil | `/grosir/profil` | Pratinjau kartu kepercayaan supplier |

**Cara tes peringatan harga:** saat membuka batch, isi tier dengan harga ≥ harga pasar. Peringatan muncul, tapi batch tetap bisa disimpan.

**Cara tes tutup batch:**
- Tutup batch yang kuotanya belum tercapai → status **tidak tercapai**, tidak ada tagihan.
- Tutup batch yang kuotanya tercapai → harga final dibekukan dan pesanan berstatus **menunggu bayar**.

---

## 5. Dashboard admin `/admin`

Masuk dengan **Coba sebagai Admin**.

| Fitur | Rute | Cara tes |
|---|---|---|
| KPI | `/admin` | Ringkasan dan pembagian pesan per jalur agen |
| Batch & pesanan | `/admin/batch` | Filter status, tutup batch, catat status pembayaran dan penyerahan per pesanan |
| Supplier | `/admin/supplier` | Verifikasi supplier, hubungkan ke akun grosir (isi kata sandi untuk membuat akun grosir baru) |
| Aktivitas AI | `/admin/aktivitas-ai` | Daftar trace agen: tahap, intent, tool, latensi |
| Hapus pesanan simulator | Dasbor admin | Semua pesanan simulator di batch terbuka terhapus |

---

## 6. Hak akses

`proxy.ts` membatasi setiap dashboard sesuai peran.

| Cara tes | Hasil yang benar |
|---|---|
| Buka `/admin`, `/grosir`, atau `/akun` tanpa login | Dialihkan ke `/masuk` |
| Login sebagai pembeli, lalu buka `/admin` | Dialihkan ke `/akun` |
| Login sebagai grosir, lalu buka `/akun` | Dialihkan ke `/grosir` |

---

## 7. WhatsApp asli

Belum aktif. Webhook `/api/whatsapp/webhook` membalas 503 sampai env `WHATSAPP_*` diisi di Vercel dan webhook didaftarkan di Meta (lihat README → Panduan teknis → WhatsApp Cloud API). Untuk demo, gunakan simulator; alurnya identik.

---

## 8. Tes otomatis

```bash
npm test                                    # Vitest (unit + integrasi) dan pytest pipeline harga
SKIP_PYTEST=1 npm test                      # tanpa pytest, bila Python/pytest belum terpasang
npx vitest run scripts/demo                 # hanya tes data demo
npx tsc --noEmit && npm run lint && npm run build
supabase start && supabase db reset && supabase test db   # tes database pgTAP, butuh Docker + Supabase CLI
```

| Tes | Yang dijaga |
|---|---|
| `scripts/demo/plan.test.ts` | Jumlah dan status batch demo, hemat 3–12%, tiap batch punya foto sendiri, data reset harian |
| `lib/trust/*.test.ts` | Cek harga wajar, kartu supplier, radar permintaan, saran harga |
| `lib/agent/**` | Router agen, classifier, tahap 2, guard konfirmasi |
| `supabase/tests/*.sql` | Aturan database: peran, batas simulator, reset demo, storage |

### Evaluasi agen AI

```bash
npm run eval -- --mode router    # juga --mode fixed-only, --mode llm-only
npm run eval:report              # menulis evals/REPORT.md
```

---

## 9. Checklist demo singkat

1. `/` — angka hemat wajar dan semua foto batch tampil.
2. `/simulator` — `MULAI` → pilih batch → isi jumlah → **Ya, ikut**; coba juga "harga cabai berapa?".
3. `/masuk` → **Coba sebagai Pembeli** → lihat pesanan dan total hemat.
4. `/masuk` → **Coba sebagai Grosir** → buka radar, lalu coba asisten harga di buka batch.
5. `/masuk` → **Coba sebagai Admin** → lihat Aktivitas AI dan tutup satu batch.
6. Setelah demo, jalankan `npm run demo:seed` untuk mengembalikan data (atau tunggu reset malam).
