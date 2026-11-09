"""Mode harian: LightGBM global vs baseline, walk-forward berbasis waktu.
LightGBM hanya dipakai bila MAE-nya mengalahkan baseline terbaik."""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config as C
from .features import FITUR, buat_fitur
from .models import menang_dari_baseline, metrik

BASELINE_HARIAN = {"naive": "harga", "ma7": "roll_7"}


def _lgbm():
    import lightgbm as lgb  # import di sini: mode bulanan tidak butuh lightgbm
    return lgb.LGBMRegressor(n_estimators=200, learning_rate=0.05, num_leaves=15,
                             min_child_samples=10, subsample=0.8, subsample_freq=1,
                             colsample_bytree=0.8, random_state=42, verbose=-1)


def _X(df: pd.DataFrame, kategori) -> pd.DataFrame:
    X = df[FITUR].copy()
    X["komoditas"] = pd.Categorical(X["komoditas"], categories=kategori)
    return X


def backtest_harian(feat: pd.DataFrame, n_fold: int = C.N_FOLD_HARIAN,
                    fold_hari: int = C.FOLD_HARI, min_train: int = 60) -> pd.DataFrame:
    """Expanding window. Latih hanya pada baris yang TANGGAL TARGET-nya < awal fold uji."""
    d = feat.dropna(subset=["harga", "target"]).copy()
    kategori = sorted(d["komoditas"].unique())
    akhir = d["tanggal_target"].max()
    hasil = []
    for i in range(n_fold, 0, -1):
        mulai = akhir - pd.Timedelta(days=i * fold_hari - 1)
        selesai = mulai + pd.Timedelta(days=fold_hari - 1)
        latih = d[d["tanggal_target"] < mulai]
        uji = d[(d["tanggal_target"] >= mulai) & (d["tanggal_target"] <= selesai)].copy()
        if len(latih) < min_train or uji.empty:
            continue
        m = _lgbm().fit(_X(latih, kategori), latih["target_ratio"])
        uji["pred_lightgbm"] = uji["harga"] * (1 + m.predict(_X(uji, kategori)))
        for nama, kol in BASELINE_HARIAN.items():
            uji[f"pred_{nama}"] = uji[kol].fillna(uji["harga"])
        uji["fold"] = n_fold - i + 1
        hasil.append(uji)
    if not hasil:
        return pd.DataFrame()
    return pd.concat(hasil, ignore_index=True)


def ringkas_backtest(bt: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for nama in ["lightgbm", *BASELINE_HARIAN]:
        rows.append({"model": nama, **metrik(bt["target"], bt[f"pred_{nama}"])})
    return pd.DataFrame(rows)


def pilih_model_harian(ringkas: pd.DataFrame) -> str:
    base = ringkas[ringkas["model"] != "lightgbm"].sort_values("MAE").iloc[0]
    lgb_mae = float(ringkas.loc[ringkas["model"] == "lightgbm", "MAE"].iloc[0])
    # Margin sama dengan mode bulanan: LightGBM harus >= MARGIN_MENANG_NAIVE lebih baik.
    return "lightgbm" if menang_dari_baseline(lgb_mae, float(base["MAE"])) else str(base["model"])


def jalankan_harian(daily: pd.DataFrame, horizons=C.HORIZON_HARIAN):
    """Return dict per horizon: backtest, ringkasan, model terpilih, model terlatih,
    dan prediksi dari titik terakhir tiap komoditas."""
    out = {}
    n_per_kom = daily.dropna(subset=["harga"]).groupby("komoditas").size()
    cukup = bool((n_per_kom >= C.MIN_TITIK_ML).all())
    for h in horizons:
        feat = buat_fitur(daily, h)
        bt = backtest_harian(feat) if cukup else pd.DataFrame()
        if bt.empty:
            ringkas, terpilih = pd.DataFrame(), "naive"
        else:
            ringkas = ringkas_backtest(bt)
            terpilih = pilih_model_harian(ringkas)
        latih = feat.dropna(subset=["harga", "target"])
        kategori = sorted(latih["komoditas"].unique())
        model = _lgbm().fit(_X(latih, kategori), latih["target_ratio"]) if terpilih == "lightgbm" else None
        asal = feat.dropna(subset=["harga"]).sort_values("tanggal").groupby("komoditas").tail(1).copy()
        if model is not None:
            asal["prediksi"] = asal["harga"] * (1 + model.predict(_X(asal, kategori)))
        else:
            asal["prediksi"] = asal[BASELINE_HARIAN[terpilih]].fillna(asal["harga"])
        residual = {}
        if not bt.empty:
            for kom, g in bt.groupby("komoditas"):
                residual[kom] = (g["target"] - g[f"pred_{terpilih}"]).to_numpy()
        out[h] = {"backtest": bt, "ringkas": ringkas, "terpilih": terpilih, "model": model,
                  "kategori": kategori, "prediksi": asal, "residual": residual}
    return out
