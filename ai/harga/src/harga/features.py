"""Fitur untuk MODE HARIAN (aktif otomatis bila data harian)."""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config as C


def ke_harian(df_long: pd.DataFrame, maks_ffill: int = C.FFILL_MAKS_HARI) -> pd.DataFrame:
    """df_long: kolom tanggal, komoditas, harga. Resample harian per komoditas,
    forward-fill maksimal `maks_ffill` hari; kolom is_imputed menandai isian.
    Celah > maks_ffill tetap NaN (tidak dikarang)."""
    out = []
    for kom, g in df_long.groupby("komoditas"):
        s = g.groupby("tanggal")["harga"].median().sort_index()
        idx = pd.date_range(s.index.min(), s.index.max(), freq="D")
        asli = s.reindex(idx)
        isi = asli.ffill(limit=maks_ffill)
        out.append(pd.DataFrame({"tanggal": idx, "komoditas": kom, "harga": isi.to_numpy(),
                                 "is_imputed": (asli.isna() & isi.notna()).to_numpy()}))
    return pd.concat(out, ignore_index=True)


def fitur_kalender(tanggal: pd.Series) -> pd.DataFrame:
    t = pd.to_datetime(pd.Series(tanggal)).reset_index(drop=True)
    f = pd.DataFrame({"day_of_week": t.dt.day_of_week.to_numpy()})
    for nama, rentang in C.HARI_BESAR.items():
        flag = np.zeros(len(t), dtype=bool)
        for a, b in rentang:
            flag |= ((t >= pd.Timestamp(a)) & (t <= pd.Timestamp(b))).to_numpy()
        f[f"is_{nama}"] = flag.astype(int)
    f["is_nataru"] = C.is_nataru(t).astype(int)
    return f


FITUR = ([f"r_lag_{k}" for k in C.LAGS_HARIAN] + [f"r_roll_{w}" for w in C.ROLLING_HARIAN]
         + ["is_imputed_int", "day_of_week", "is_ramadan", "is_idulfitri", "is_iduladha",
            "is_nataru", "komoditas"])


def buat_fitur(daily: pd.DataFrame, h: int) -> pd.DataFrame:
    """Baris = titik asal t. Fitur hanya memakai info s.d. t; target = harga t+h.
    Fitur rasio (skala-bebas) supaya satu model global bisa untuk semua komoditas."""
    bagian = []
    for kom, g in daily.sort_values("tanggal").groupby("komoditas"):
        g = g.reset_index(drop=True)
        p = g["harga"]
        f = pd.DataFrame({"tanggal": g["tanggal"], "komoditas": kom, "harga": p,
                          "is_imputed_int": g["is_imputed"].astype(int)})
        for k in C.LAGS_HARIAN:
            f[f"lag_{k}"] = p.shift(k)
            f[f"r_lag_{k}"] = p / p.shift(k) - 1
        for w in C.ROLLING_HARIAN:
            roll = p.rolling(w, min_periods=max(2, w // 2)).mean()
            f[f"roll_{w}"] = roll
            f[f"r_roll_{w}"] = p / roll - 1
        f["tanggal_target"] = g["tanggal"] + pd.Timedelta(days=h)
        f["target"] = p.shift(-h)
        f["target_ratio"] = f["target"] / p - 1
        kal = fitur_kalender(f["tanggal_target"])
        bagian.append(pd.concat([f, kal], axis=1))
    out = pd.concat(bagian, ignore_index=True)
    out["horizon"] = h
    return out
