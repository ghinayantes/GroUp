# ML — Prediksi Harga Bahan Baku

Prediksi harga bulan depan untuk 13 bahan baku UMKM kuliner Kota Bandung (seri PIHPS), sebagai pendukung keputusan patungan GroUp: kapan sebaiknya ikut batch dan apakah stok perlu dibeli lebih awal.

## Struktur

- `dataset/` — CSV gabungan harga 2026 (PIHPS, SP2KP, berita).
- `src/harga/` — pipeline: load → cleaning → model + walk-forward → prediksi.
- `notebooks/data_train.ipynb` — narasi EDA, pemilihan model, dan hasil.
- `tests/` — test pipeline (pytest).
- `train.py` — latih ulang tanpa notebook.
- `output/` — hasil: `prediksi.csv`, `prediksi.json`, model `*.joblib`, `cache_meta.json`.

## Setup

Butuh Python 3.13. Dari folder `ml/`:

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

Notebook bisa dijalankan dari `ml/` atau `ml/notebooks/`; pilih kernel dari `.venv`.

## Output untuk aplikasi

`output/prediksi.json` berisi `mode`, `dibuat`, dan daftar `prediksi` (kolom sama dengan `prediksi.csv`): `komoditas`, `harga_terakhir`, `prediksi`, `batas_bawah`, `batas_atas`, `status` (`STABIL`/`NAIK`/`TURUN`/`TIDAK PASTI`/`BERGEJOLAK`), `saran`, serta metadata `model`, `mape_validasi`, `n_titik`, `sumber`, `catatan`.

Data saat ini bulanan (11 titik), jadi prediksi = harga awal bulan depan. Bila CSV diganti data harian PIHPS, pipeline otomatis beralih ke mode harian (LightGBM vs baseline, horizon 1 dan 7 hari).
