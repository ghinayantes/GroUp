"""Cleaning: nama kanonik, seri turunan, agregasi, flag (tanpa membuang baris). Satuan sumber dipertahankan."""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config as C


def kanonikkan_nama(df: pd.DataFrame) -> pd.DataFrame:
    """Alias -> nama kanonik. Bila nama kanonik sudah ada di (tanggal, sumber) yang sama,
    baris alias dibuang (nilainya identik, terbukti di EDA); bila belum ada, di-rename."""
    df = df.copy()
    is_alias = df["komoditas"].isin(C.ALIAS_KANONIK)
    target = df["komoditas"].map(C.ALIAS_KANONIK)
    kunci_kanonik = set(zip(df.loc[~is_alias, "tanggal"], df.loc[~is_alias, "sumber_id"],
                            df.loc[~is_alias, "komoditas"]))
    sudah_ada = np.array([
        (t, s, k) in kunci_kanonik
        for t, s, k in zip(df["tanggal"], df["sumber_id"], target)
    ]) & is_alias.to_numpy()
    df = df.loc[~sudah_ada].copy()
    df["komoditas"] = df["komoditas"].replace(C.ALIAS_KANONIK)
    return df


def tambah_seri_turunan(df: pd.DataFrame) -> pd.DataFrame:
    """Seri turunan = rata-rata subjenis pada (tanggal, sumber) yang sama, hanya bila
    SEMUA subjenis tersedia dan seri itu belum ada di sumber tsb."""
    df = df.copy()
    df["turunan"] = False
    baru = []
    for nama, subs in C.SERI_TURUNAN.items():
        s = df[df["komoditas"].isin(subs)]
        if s.empty:
            continue
        ada = set(zip(df.loc[df["komoditas"] == nama, "tanggal"],
                      df.loc[df["komoditas"] == nama, "sumber_id"]))
        for (t, src, sat, jh), g in s.groupby(["tanggal", "sumber_id", "satuan", "jenis_harga"]):
            if (t, src) in ada or set(g["komoditas"]) != set(subs):
                continue
            per_sub = g.groupby("komoditas")["harga"].median()
            baru.append({"tanggal": t, "komoditas": nama, "satuan": sat,
                         "harga": float(per_sub.mean()), "jenis_harga": jh,
                         "sumber_id": src, "turunan": True})
    if baru:
        df = pd.concat([df, pd.DataFrame(baru)], ignore_index=True)
    return df


def agregasi(df: pd.DataFrame) -> pd.DataFrame:
    """Satu baris per (tanggal, komoditas, sumber, satuan, jenis_harga):
    median + min + max + n_obs (untuk berita multi-pasar)."""
    kunci = ["tanggal", "komoditas", "sumber_id", "satuan", "jenis_harga"]
    out = df.groupby(kunci, as_index=False).agg(
        harga=("harga", "median"), harga_min=("harga", "min"), harga_max=("harga", "max"),
        n_obs=("harga", "size"), turunan=("turunan", "any"),
    )
    out["level"] = out["sumber_id"].map(C.LEVEL_SUMBER).fillna("tidak_diketahui")
    out["is_eceran"] = out["jenis_harga"].eq("eceran")
    return out


def _panjang_run(nilai: np.ndarray) -> np.ndarray:
    """Panjang run nilai-sama-berturut tempat tiap titik berada."""
    n = len(nilai)
    run = np.ones(n, dtype=int)
    if n == 0:
        return run
    batas = np.r_[True, nilai[1:] != nilai[:-1]]
    id_run = np.cumsum(batas)
    ukuran = np.bincount(id_run)
    return ukuran[id_run]


def tandai_flag(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values(["sumber_id", "komoditas", "jenis_harga", "tanggal"]).reset_index(drop=True)
    df["is_frozen"] = False
    df["is_outlier"] = False
    df["pct_change"] = np.nan
    for _, idx in df.groupby(["sumber_id", "komoditas", "jenis_harga"]).groups.items():
        h = df.loc[idx, "harga"].to_numpy()
        df.loc[idx, "is_frozen"] = _panjang_run(h) >= C.FROZEN_MIN_RUN
        pct = pd.Series(h).pct_change().to_numpy()
        df.loc[idx, "pct_change"] = pct
        valid = pct[~np.isnan(pct)]
        if len(valid) >= C.OUTLIER_MIN_TITIK:
            q1, q3 = np.quantile(valid, [0.25, 0.75])
            iqr = q3 - q1
            lo, hi = q1 - C.OUTLIER_IQR_K * iqr, q3 + C.OUTLIER_IQR_K * iqr
            luar = (pct < lo) | (pct > hi)
            df.loc[idx, "is_outlier"] = luar & (np.abs(pct) >= C.OUTLIER_MIN_PCT)
    return df


def bersihkan(df_raw: pd.DataFrame) -> pd.DataFrame:
    """Pipeline cleaning lengkap. Tidak ada baris yang dibuang diam-diam:
    hanya alias identik yang dilebur; sisanya diberi flag."""
    df = kanonikkan_nama(df_raw)
    df = tambah_seri_turunan(df)
    df = agregasi(df)
    return tandai_flag(df)


def seri_target(df_clean: pd.DataFrame, sumber: str = C.SUMBER_TARGET,
                komoditas=None) -> pd.DataFrame:
    """Tabel lebar tanggal x komoditas untuk satu sumber (eceran saja)."""
    komoditas = komoditas or C.TARGET_KOMODITAS
    s = df_clean[(df_clean["sumber_id"] == sumber) & df_clean["is_eceran"]
                 & df_clean["komoditas"].isin(komoditas)]
    wide = s.pivot_table(index="tanggal", columns="komoditas", values="harga", aggfunc="median")
    return wide.reindex(columns=[k for k in komoditas if k in wide.columns]).sort_index()
