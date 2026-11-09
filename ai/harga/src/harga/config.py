"""Konfigurasi pipeline prediksi harga bahan baku (Kota Bandung).

Semua angka di sini adalah KEPUTUSAN/ASUMSI yang dicatat, bukan data.
"""
from __future__ import annotations

import pandas as pd

# --- Nama kanonik: alias PIHPS yang nilainya identik (terbukti di EDA) ---
ALIAS_KANONIK = {
    "bawang_merah_ukuran_sedang": "bawang_merah",
    "bawang_putih_ukuran_sedang": "bawang_putih",
    "daging_ayam": "daging_ayam_ras",
    "telur_ayam": "telur_ayam_ras",
}

# --- Seri turunan: dihitung dari subjenis yang ada di sumber yang sama ---
# beras_medium (PIHPS) = rata-rata beras_kualitas_medium_i & _ii (keputusan user).
SERI_TURUNAN = {
    "beras_medium": ["beras_kualitas_medium_i", "beras_kualitas_medium_ii"],
}

# --- 13 komoditas UMKM kuliner (seri target): 8 utama + 5 tambahan ---
TARGET_KOMODITAS = [
    "beras_medium",
    "gula_pasir",
    "minyak_goreng_curah",
    "telur_ayam_ras",
    "daging_ayam_ras",
    "cabai_merah_keriting",
    "cabai_rawit_merah",
    "bawang_merah",
    # Tambahan (seri PIHPS, 11 titik, sama panjang dengan target awal):
    "bawang_putih",
    "cabai_merah_besar",
    "cabai_rawit_hijau",
    "daging_sapi",                  # ~ rata-rata kualitas_1 & _2 (selisih maks Rp25) -> subjenis tidak ikut
    "gula_pasir_kualitas_premium",
]
SUMBER_TARGET = "PIHPS"

# Komoditas mudah rusak -> saran beli tidak boleh "stok banyak".
# bawang_putih & gula sengaja tidak masuk (relatif tahan simpan).
MUDAH_RUSAK = {"cabai_merah_keriting", "cabai_rawit_merah", "bawang_merah",
               "daging_ayam_ras", "telur_ayam_ras",
               "cabai_merah_besar", "cabai_rawit_hijau", "daging_sapi"}

# --- Level geografis sumber ---
LEVEL_SUMBER = {
    "PIHPS": "kota_bandung",
    "pasar_berita": "kota_bandung",
    "disdagin_berita": "kota_bandung",
    "pihps_berita": "kota_bandung",
    "sp2kp_databoks": "jawa_barat",
    "bisnis_pihps_jabar": "jawa_barat",
    "tepas_jabar_databoks": "jawa_barat",
}

# --- Satuan ---
# ASUMSI (bukan dari data): densitas minyak goreng sawit ~0,9 kg/L.
# Harga Rp/L dikonversi ke Rp/kg: harga_kg = harga_liter / DENSITAS.
DENSITAS_MINYAK_KG_PER_L = 0.9

# --- Flag kualitas data ---
FROZEN_MIN_RUN = 3          # >=3 titik berturut-turut bernilai sama -> is_frozen
OUTLIER_IQR_K = 3.0         # IQR pada % perubahan antar-titik
OUTLIER_MIN_TITIK = 5
OUTLIER_MIN_PCT = 0.10      # perubahan < 10% tidak pernah dianggap outlier (seri datar: IQR=0)

# --- Model ---
MIN_TRAIN_BULANAN = 4       # walk-forward mulai setelah 4 titik
MA_WINDOW_BULANAN = 3
SES_ALPHA_GRID = [round(a, 2) for a in (0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9)]
PI_KUANTIL = (0.10, 0.90)   # prediction interval empiris dari residual walk-forward
# Model non-naive hanya dipilih bila MAE-nya >= 10% lebih kecil dari naive
# (7 titik uji terlalu sedikit untuk percaya selisih 1-2%).
MARGIN_MENANG_NAIVE = 0.10
# Lebar minimum interval: +-1% dari prediksi (7 residual bisa semuanya 0 -> interval palsu sempit).
LEBAR_MIN_INTERVAL = 0.01
MIN_TITIK_ML = 30           # di bawah ini, LightGBM/SARIMA tidak dipakai

# --- Mode harian ---
FFILL_MAKS_HARI = 3
LAGS_HARIAN = [1, 7, 14]
ROLLING_HARIAN = [7, 30]
HORIZON_HARIAN = [1, 7]
N_FOLD_HARIAN = 4
FOLD_HARI = 14

# --- Status & saran ---
AMBANG_STATUS = 0.05        # +-5%
AMBANG_KETIDAKPASTIAN = 0.30  # lebar interval / prediksi
AMBANG_MAPE_BERGEJOLAK = 0.10  # FRAKSI (10%). mape_validasi disimpan dalam persen -> dibandingkan mape/100

# --- Kalender (tanggal inklusif) ---
# Ramadan & Idulfitri: dari user. Iduladha 1447 H: 27 Mei 2026 (sidang isbat
# Kemenag; cuti bersama 28 Mei, SKB 3 Menteri 2026) - diverifikasi, bukan tebakan.
HARI_BESAR = {
    "ramadan": [("2026-02-18", "2026-03-19")],
    "idulfitri": [("2026-03-20", "2026-03-21")],
    "iduladha": [("2026-05-27", "2026-05-28")],
}
# Nataru: DEFINISI jendela (bukan data), berlaku tiap tahun.
NATARU_MULAI = (12, 15)     # 15 Des
NATARU_SELESAI = (1, 5)     # 5 Jan


def is_nataru(tanggal: pd.Series | pd.DatetimeIndex) -> pd.Series:
    t = pd.Series(pd.to_datetime(tanggal))
    md = t.dt.month * 100 + t.dt.day
    mulai = NATARU_MULAI[0] * 100 + NATARU_MULAI[1]
    selesai = NATARU_SELESAI[0] * 100 + NATARU_SELESAI[1]
    return ((md >= mulai) | (md <= selesai)).to_numpy()
