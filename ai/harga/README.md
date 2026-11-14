# Harga pasar bahan baku (PIHPS)

Harga pasar terkini dan status volatilitas untuk 13 bahan baku UMKM kuliner Kota Bandung (seri PIHPS), dengan prediksi harga bulan depan sebagai pelengkap. Dipakai GroUp untuk membandingkan harga batch dengan harga pasar.

## Struktur

- `dataset/` — CSV gabungan harga 2026 dari tujuh sumber (lihat [Sumber data](#sumber-data)).
- `src/harga/` — pipeline: load → cleaning → model + walk-forward → prediksi.
- `notebooks/data_train.ipynb` — narasi EDA, pemilihan model, dan hasil.
- `tests/` — test pipeline (pytest).
- `train.py` — latih ulang tanpa notebook.
- `output/` — hasil: `prediksi.csv`, `prediksi.json`, model `*.joblib`, `cache_meta.json`.

## Sumber data

`dataset/dataset_gabungan_komoditas_2026.csv` berisi 610 baris harga eceran dari tujuh sumber. Kolom `sumber_id` menunjukkan asal setiap baris.

| `sumber_id` | Sumber | Level | Baris | Periode | Dipakai untuk |
|---|---|---|---|---|---|
| `PIHPS` | Pusat Informasi Harga Pangan Strategis (PIHPS) Nasional, Bank Indonesia | Kota Bandung | 341 | Jan–2 Nov 2026 | **Seri target**: model, `prediksi.json`, dan harga pasar di aplikasi |
| `sp2kp_databoks` | Sistem Pemantauan Pasar Kebutuhan Pokok (SP2KP), Kementerian Perdagangan, via Databoks | Jawa Barat | 205 | 28 Apr–30 Okt 2026 | Pembanding saat analisis |
| `pasar_berita` | Berita harga di pasar tradisional | Kota Bandung | 36 | Feb–Sep 2026 | Pembanding saat analisis |
| `disdagin_berita` | Rilis dan berita Disdagin Kota Bandung | Kota Bandung | 12 | Feb–Jun 2026 | Pembanding saat analisis |
| `bisnis_pihps_jabar` | Berita Bisnis.com yang mengutip PIHPS | Jawa Barat | 10 | 19 Feb 2026 | Pembanding saat analisis |
| `pihps_berita` | Berita yang mengutip PIHPS | Kota Bandung | 3 | 23 Okt 2026 | Pembanding saat analisis |
| `tepas_jabar_databoks` | Tepas Jabar via Databoks (komoditas ikan) | Jawa Barat | 3 | 30 Okt 2026 | Pembanding saat analisis |

**Hanya PIHPS yang masuk model** (`SUMBER_TARGET` di `src/harga/config.py`). Sumber lain tidak digabung ke seri target karena tiga alasan:

- **Cakupan berbeda.** SP2KP dan Tepas berlevel Jawa Barat, bukan Kota Bandung.
- **Definisi dan satuan berbeda.** Harga beras SP2KP (±Rp13.100–13.400/kg) lebih rendah daripada PIHPS (±Rp15.150–15.600/kg), dan SP2KP mencatat minyak goreng per liter, sedangkan PIHPS per kg.
- **Data jarang atau beku.** Sumber berita hanya berisi titik lepas, dan sebagian seri SP2KP bernilai sama selama berminggu-minggu.

Notebook `notebooks/data_train.ipynb` memakai sumber-sumber ini untuk memvalidasi tren PIHPS.

## Setup

Butuh Python 3.13. Dari folder `ai/harga/`:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Menjalankan

```powershell
python train.py            # latih (pakai cache bila CSV & kode tidak berubah)
python train.py --paksa    # paksa latih ulang
python -m pytest -q tests  # test
jupyter nbconvert --to notebook --execute --inplace notebooks/data_train.ipynb
```

Notebook bisa dijalankan dari `ai/harga/` atau `ai/harga/notebooks/`; pilih kernel dari `.venv`.

## Output untuk aplikasi

`output/prediksi.json` berisi `mode`, `dibuat`, dan daftar `prediksi` (kolom sama dengan `prediksi.csv`): `komoditas`, `tanggal_terakhir`, `harga_terakhir`, `satuan`, `prediksi`, `batas_bawah`, `batas_atas`, `status` (`STABIL`/`NAIK`/`TURUN`/`TIDAK PASTI`/`BERGEJOLAK`), `saran`, serta metadata `model`, `mape_validasi`, `n_titik`, `sumber`, `catatan`.

- **Satuan.** Harga dipakai dalam satuan sumber, tanpa konversi densitas. PIHPS menerbitkan minyak goreng curah per **kg**, jadi `satuan` minyak di output adalah `kg`. Aplikasi wajib membandingkan harga hanya bila satuannya sama dengan satuan batch.
- **Dipakai aplikasi.** `lib/agent/adapters/market-price.ts` membaca file ini untuk tool `harga_pasar`: `harga_terakhir` sebagai harga pasar terkini (Kota Bandung, PIHPS) beserta tanggalnya. Field prediksi belum diekspos karena `MarketPricePort` belum punya field-nya.

## Cara membaca hasilnya

Data saat ini bulanan (11 titik per komoditas), jadi `prediksi` = harga awal bulan depan dan MAPE dihitung dari ±7 titik uji walk-forward. Model non-naive hanya dipilih bila menang ≥10% atas naive; pada data sekarang 11 dari 13 komoditas memilih **naive** (prediksi = harga terakhir). Sebutlah fitur ini **"harga pasar terkini + status volatilitas"**, dengan prediksi sebagai pelengkap, bukan "ML memprediksi harga".

Mode harian (LightGBM vs baseline, horizon 1 dan 7 hari) aktif otomatis bila CSV berisi data harian, tetapi **baru diuji dengan data sintetis** (`tests/test_pipeline.py`), belum dengan data PIHPS harian asli.

## Tes

`npm test` di root repo ikut menjalankan `pytest` folder ini lewat `ai/harga/pytest.test.ts` (memakai `ai/harga/.venv` bila ada, selain itu `python` di PATH). Tanpa Python + dependensi, tes itu gagal dengan pesan cara setup. Lewati sementara dengan `SKIP_PYTEST=1 npm test`.
