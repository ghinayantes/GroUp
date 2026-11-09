"""Model ringan untuk seri pendek + validasi walk-forward."""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config as C


class Naive:
    nama = "naive"

    def fit(self, y):
        self.last_ = float(np.asarray(y, float)[-1])
        return self

    def predict(self, h: int = 1) -> float:
        return self.last_


class MovingAverage:
    def __init__(self, window: int = C.MA_WINDOW_BULANAN):
        self.window = window
        self.nama = f"ma{window}"

    def fit(self, y):
        y = np.asarray(y, float)
        self.level_ = float(y[-self.window:].mean())
        return self

    def predict(self, h: int = 1) -> float:
        return self.level_


class Drift:
    nama = "drift"

    def fit(self, y):
        y = np.asarray(y, float)
        self.last_ = float(y[-1])
        self.slope_ = float((y[-1] - y[0]) / (len(y) - 1)) if len(y) > 1 else 0.0
        return self

    def predict(self, h: int = 1) -> float:
        return self.last_ + h * self.slope_


class SES:
    """Simple exponential smoothing; alpha dipilih dari grid dengan meminimalkan
    SSE one-step-ahead di data latih SAJA."""
    nama = "ses"

    def __init__(self, alphas=C.SES_ALPHA_GRID):
        self.alphas = list(alphas)

    @staticmethod
    def _filter(y, a):
        level, sse = y[0], 0.0
        for v in y[1:]:
            sse += (v - level) ** 2
            level = a * v + (1 - a) * level
        return level, sse

    def fit(self, y):
        y = np.asarray(y, float)
        hasil = [(self._filter(y, a), a) for a in self.alphas]
        (self.level_, _), self.alpha_ = min(hasil, key=lambda r: r[0][1])
        return self

    def predict(self, h: int = 1) -> float:
        return float(self.level_)


def kandidat_bulanan():
    return [Naive(), MovingAverage(), Drift(), SES()]


def buat_model(nama: str):
    for m in kandidat_bulanan():
        if m.nama == nama:
            return m
    raise KeyError(nama)


def walk_forward(y, model_factory, min_train: int = C.MIN_TRAIN_BULANAN, h: int = 1) -> pd.DataFrame:
    """Latih s.d. titik t-1, uji titik t+h-1. Model baru dibuat tiap langkah
    (tidak ada informasi masa depan yang bocor)."""
    y = np.asarray(y, float)
    rows = []
    for t in range(min_train, len(y) - h + 1):
        m = model_factory().fit(y[:t])
        pred = m.predict(h)
        rows.append({"idx_uji": t + h - 1, "aktual": y[t + h - 1], "prediksi": pred})
    out = pd.DataFrame(rows, columns=["idx_uji", "aktual", "prediksi"])
    out["residual"] = out["aktual"] - out["prediksi"]
    return out


def metrik(aktual, prediksi) -> dict:
    a, p = np.asarray(aktual, float), np.asarray(prediksi, float)
    if len(a) == 0:
        return {"MAE": np.nan, "MAPE": np.nan, "n_uji": 0}
    return {"MAE": float(np.mean(np.abs(a - p))),
            "MAPE": float(np.mean(np.abs((a - p) / a)) * 100),
            "n_uji": int(len(a))}


def menang_dari_baseline(mae_kandidat: float, mae_baseline: float,
                         margin: float = C.MARGIN_MENANG_NAIVE) -> bool:
    """True bila kandidat minimal `margin` (relatif) lebih baik dari baseline."""
    return mae_kandidat <= mae_baseline * (1 - margin) + 1e-9 and mae_kandidat < mae_baseline


def pilih_model(tabel_metrik: pd.DataFrame, baseline: str = "naive", kolom: str = "MAE",
                margin: float = C.MARGIN_MENANG_NAIVE) -> str:
    """Model non-baseline hanya dipilih bila MAE-nya minimal `margin` (default 10%)
    lebih kecil dari baseline; kalau tidak, pakai baseline."""
    t = tabel_metrik.dropna(subset=[kolom])
    if t.empty or baseline not in set(t["model"]):
        return baseline
    base = float(t.loc[t["model"] == baseline, kolom].iloc[0])
    terbaik = t.sort_values(kolom).iloc[0]
    if str(terbaik["model"]) != baseline and menang_dari_baseline(float(terbaik[kolom]), base, margin):
        return str(terbaik["model"])
    return baseline


def interval_empiris(prediksi: float, residual, kuantil=C.PI_KUANTIL,
                     lebar_min: float = C.LEBAR_MIN_INTERVAL):
    """PI dari kuantil residual walk-forward. Batas dipaksa mengapit prediksi dan
    minimal +-`lebar_min` (relatif) dari prediksi."""
    r = np.asarray(residual, float)
    r = r[~np.isnan(r)]
    if len(r) == 0:
        return np.nan, np.nan
    lo, hi = np.quantile(r, kuantil)
    lo = min(prediksi + lo, prediksi * (1 - lebar_min))
    hi = max(prediksi + hi, prediksi * (1 + lebar_min))
    return lo, hi


def backtest_bulanan(wide: pd.DataFrame, min_train: int = C.MIN_TRAIN_BULANAN):
    """Return (tabel_metrik, residual_per_model) untuk tiap komoditas di `wide`."""
    rows, residual = [], {}
    for kom in wide.columns:
        y = wide[kom].dropna().to_numpy()
        for proto in kandidat_bulanan():
            wf = walk_forward(y, lambda p=proto: buat_model(p.nama), min_train=min_train)
            rows.append({"komoditas": kom, "model": proto.nama, "n_titik": len(y),
                         **metrik(wf["aktual"], wf["prediksi"])})
            residual[(kom, proto.nama)] = wf["residual"].to_numpy()
    return pd.DataFrame(rows), residual
