# Harga pasar bahan baku (PIHPS)

Harga pasar terkini dan status volatilitas untuk 13 bahan baku UMKM kuliner Kota Bandung (seri PIHPS), dengan prediksi harga bulan depan sebagai pelengkap. Dipakai GroUp untuk membandingkan harga batch dengan harga pasar.

## Struktur

- `dataset/` — CSV gabungan harga 2026 (PIHPS, SP2KP, berita).
- `src/harga/` — pipeline: load → cleaning → model + walk-forward → prediksi.
- `notebooks/data_train.ipynb` — narasi EDA, pemilihan model, dan hasil.
- `tests/` — test pipeline (pytest).
- `train.py` — latih ulang tanpa notebook.
- `output/` — hasil: `prediksi.csv`, `prediksi.json`, model `*.joblib`, `cache_meta.json`.

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
