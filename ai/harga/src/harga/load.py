"""Load CSV & deteksi frekuensi data."""
from __future__ import annotations

import pandas as pd

KOLOM_WAJIB = ["tanggal", "komoditas", "satuan", "harga", "jenis_harga", "sumber_id"]


def load_csv(path) -> pd.DataFrame:
    df = pd.read_csv(path)
    hilang = [c for c in KOLOM_WAJIB if c not in df.columns]
    if hilang:
        raise ValueError(f"Kolom wajib hilang: {hilang}")
    df["tanggal"] = pd.to_datetime(df["tanggal"])
    df["harga"] = pd.to_numeric(df["harga"], errors="coerce")
    for c in ["komoditas", "satuan", "jenis_harga", "sumber_id"]:
        df[c] = df[c].astype(str).str.strip()
    df["komoditas"] = df["komoditas"].str.lower()
    return df.dropna(subset=["harga"]).reset_index(drop=True)


def median_gap_hari(tanggal) -> float:
    d = pd.Series(sorted(pd.to_datetime(pd.Series(tanggal)).unique()))
    if len(d) < 2:
        return float("nan")
    return float(d.diff().dt.days.dropna().median())


def deteksi_frekuensi(tanggal) -> str:
    """'harian' bila median jarak antartanggal <= 2 hari, 'bulanan' bila >= 25,
    selain itu 'mingguan/tidak_teratur' (diperlakukan seperti bulanan: model ringan)."""
    g = median_gap_hari(tanggal)
    if g != g:  # NaN
        raise ValueError("Butuh minimal 2 tanggal untuk deteksi frekuensi.")
    if g <= 2:
        return "harian"
    if g >= 25:
        return "bulanan"
    return "tidak_teratur"
