"""Entry point: CSV -> output/prediksi.csv + output/prediksi.json + output/*.joblib.
Mode (bulanan/harian) dipilih otomatis dari frekuensi data PIHPS."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from . import config as C
from .clean import bersihkan, seri_target
from .daily import jalankan_harian
from .features import ke_harian
from .load import deteksi_frekuensi, load_csv
from .models import backtest_bulanan, buat_model, interval_empiris, pilih_model

KOLOM_OUTPUT = ["komoditas", "horizon", "tanggal_terakhir", "harga_terakhir", "satuan", "tanggal_target",
                "prediksi", "batas_bawah", "batas_atas", "perubahan_pct", "status", "saran",
                "model", "mape_validasi", "n_titik", "sumber", "catatan"]


def bergejolak(mape_pct: float) -> bool:
    """mape_validasi (dalam persen) > AMBANG_MAPE_BERGEJOLAK (fraksi)."""
    return mape_pct == mape_pct and mape_pct / 100 > C.AMBANG_MAPE_BERGEJOLAK


def status_dari(harga_terakhir: float, prediksi: float, batas_bawah: float | None = None,
                batas_atas: float | None = None, mape: float = float("nan"),
                ambang: float = C.AMBANG_STATUS) -> str:
    """Urutan cek: mape > AMBANG_MAPE_BERGEJOLAK -> BERGEJOLAK (apa pun perubahannya).
    Lalu |perubahan| < ambang -> STABIL. NAIK/TURUN hanya bila |perubahan| >= ambang DAN
    seluruh interval di atas/bawah harga terakhir. Interval memuat harga terakhir
    (atau interval tidak tersedia/NaN) -> TIDAK PASTI.
    Tanpa batas sama sekali (None) dipakai aturan ambang saja."""
    if bergejolak(mape):
        return "BERGEJOLAK"
    d = prediksi / harga_terakhir - 1
    if abs(d) < ambang:
        return "STABIL"
    if batas_bawah is None and batas_atas is None:
        return "NAIK" if d > 0 else "TURUN"
    lo, hi = batas_bawah, batas_atas
    if lo is None or hi is None or lo != lo or hi != hi:      # NaN -> tidak bisa dibuktikan
        return "TIDAK PASTI"
    if d > 0 and lo > harga_terakhir:
        return "NAIK"
    if d < 0 and hi < harga_terakhir:
        return "TURUN"
    return "TIDAK PASTI"


def saran_dari(status: str, komoditas: str, lebar_relatif: float, mape: float = float("nan")) -> str:
    if status == "BERGEJOLAK" or bergejolak(mape):
        return "Harga bergejolak, beli sesuai kebutuhan"
    if status == "TIDAK PASTI":
        return "Arah harga belum jelas, beli sesuai kebutuhan; pantau harga"
    if status == "NAIK":
        s = ("Stok lebih awal secukupnya (mudah rusak, jangan menimbun)"
             if komoditas in C.MUDAH_RUSAK else "Stok lebih awal sebelum harga naik")
    elif status == "TURUN":
        s = "Tunda pembelian besar, beli sesuai kebutuhan"
    else:
        s = "Beli seperti biasa"
    if lebar_relatif == lebar_relatif and lebar_relatif > C.AMBANG_KETIDAKPASTIAN:
        s += "; ketidakpastian tinggi, pantau harga"
    return s


def _catatan(tanggal_target: pd.Timestamp, frozen_terakhir: bool, freq: str) -> str:
    c = []
    if freq != "harian":
        c.append("Data bulanan: prediksi = harga awal bulan depan, bukan harian")
    if bool(C.is_nataru(pd.Series([tanggal_target]))[0]) or tanggal_target.month == 12:
        c.append("Periode Nataru: belum ada data Nataru historis di dataset, efek musiman TIDAK dimodelkan")
    if frozen_terakhir:
        c.append("Nilai terakhir sama >=3 titik berturut (mungkin belum diperbarui sumber)")
    return "; ".join(c)


def _baris(kom, horizon, t_last, h_last, t_target, pred, lo, hi, model, mape, n, frozen, freq, satuan):
    lebar = (hi - lo) / pred if pred else np.nan
    st = status_dari(h_last, pred, lo, hi, mape)
    return {"komoditas": kom, "horizon": horizon, "tanggal_terakhir": t_last.date(),
            "harga_terakhir": round(h_last), "satuan": satuan, "tanggal_target": t_target.date(),
            "prediksi": round(pred), "batas_bawah": round(lo) if lo == lo else np.nan,
            "batas_atas": round(hi) if hi == hi else np.nan,
            "perubahan_pct": round((pred / h_last - 1) * 100, 2), "status": st,
            "saran": saran_dari(st, kom, lebar, mape), "model": model,
            "mape_validasi": round(mape, 2) if mape == mape else np.nan, "n_titik": int(n),
            "sumber": f"{C.SUMBER_TARGET} ({C.LEVEL_SUMBER.get(C.SUMBER_TARGET)})",
            "catatan": _catatan(t_target, frozen, freq)}


def _satuan_target(clean, kom) -> str:
    satuan = clean[(clean["sumber_id"] == C.SUMBER_TARGET) & (clean["komoditas"] == kom)]["satuan"].unique()
    if len(satuan) != 1:
        raise ValueError(f"{kom}: satuan sumber {C.SUMBER_TARGET} harus tunggal, dapat {list(satuan)}")
    return str(satuan[0])


def _frozen_terakhir(clean, kom) -> bool:
    s = clean[(clean["sumber_id"] == C.SUMBER_TARGET) & (clean["komoditas"] == kom)]
    return bool(s.sort_values("tanggal")["is_frozen"].iloc[-1]) if len(s) else False


def _hapus_model_usang(out_dir: Path, komoditas_aktif) -> list[str]:
    """Hapus model_bulanan_*.joblib untuk komoditas yang sudah bukan target,
    supaya isi output/ selalu = C.TARGET_KOMODITAS."""
    aktif = {f"model_bulanan_{k}.joblib" for k in komoditas_aktif}
    usang = [p for p in out_dir.glob("model_bulanan_*.joblib") if p.name not in aktif]
    for p in usang:
        p.unlink()
    return [p.name for p in usang]


def jalankan_bulanan(clean: pd.DataFrame, out_dir: Path):
    wide = seri_target(clean)
    _hapus_model_usang(out_dir, wide.columns)
    tabel, residual = backtest_bulanan(wide)
    rows, terpilih = [], {}
    for kom in wide.columns:
        s = wide[kom].dropna()
        nama = pilih_model(tabel[tabel["komoditas"] == kom])
        terpilih[kom] = nama
        m = buat_model(nama).fit(s.to_numpy())
        pred = m.predict(1)
        lo, hi = interval_empiris(pred, residual[(kom, nama)])
        t_last = s.index[-1]
        t_target = (t_last + pd.offsets.MonthBegin(1)).normalize()
        mape = float(tabel.query("komoditas == @kom and model == @nama")["MAPE"].iloc[0])
        rows.append(_baris(kom, "1_bulan", t_last, float(s.iloc[-1]), t_target, pred, lo, hi,
                           nama, mape, len(s), _frozen_terakhir(clean, kom), "bulanan",
                           _satuan_target(clean, kom)))
        joblib.dump({"model": m, "komoditas": kom, "sumber": C.SUMBER_TARGET, "mode": "bulanan",
                     "dilatih_sampai": str(t_last.date()), "residual_wf": residual[(kom, nama)]},
                    out_dir / f"model_bulanan_{kom}.joblib")
    return pd.DataFrame(rows, columns=KOLOM_OUTPUT), {"backtest": tabel, "terpilih": terpilih,
                                                      "wide": wide}


def jalankan_mode_harian(clean: pd.DataFrame, out_dir: Path):
    s = clean[(clean["sumber_id"] == C.SUMBER_TARGET) & clean["is_eceran"]
              & clean["komoditas"].isin(C.TARGET_KOMODITAS)][["tanggal", "komoditas", "harga"]]
    daily = ke_harian(s)
    hasil = jalankan_harian(daily)
    rows = []
    for h, r in hasil.items():
        for _, p in r["prediksi"].iterrows():
            kom = p["komoditas"]
            res = r["residual"].get(kom, np.array([]))
            lo, hi = interval_empiris(float(p["prediksi"]), res)
            if r["ringkas"].empty:
                mape = np.nan
            else:
                g = r["backtest"][r["backtest"]["komoditas"] == kom]
                mape = float(np.mean(np.abs((g["target"] - g[f"pred_{r['terpilih']}"]) / g["target"])) * 100)
            n = int(daily[(daily["komoditas"] == kom) & daily["harga"].notna()].shape[0])
            rows.append(_baris(kom, f"{h}_hari", p["tanggal"], float(p["harga"]),
                               p["tanggal"] + pd.Timedelta(days=h), float(p["prediksi"]), lo, hi,
                               r["terpilih"], mape, n, _frozen_terakhir(clean, kom), "harian",
                               _satuan_target(clean, kom)))
        joblib.dump({"model": r["model"], "terpilih": r["terpilih"], "kategori": r["kategori"],
                     "horizon": h, "mode": "harian"}, out_dir / f"model_harian_h{h}.joblib")
    return pd.DataFrame(rows, columns=KOLOM_OUTPUT), {"hasil": hasil, "daily": daily}


KODE_DIR = Path(__file__).resolve().parent


def _hash(path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def _hash_kode(kode_dir: Path | None = None) -> str:
    """Hash isi semua src/harga/*.py (termasuk config.py): perubahan kode/konstanta
    membuat cache tidak valid."""
    h = hashlib.sha256()
    for p in sorted(Path(kode_dir or KODE_DIR).glob("*.py")):
        h.update(p.name.encode()); h.update(p.read_bytes())
    return h.hexdigest()


def tulis_json(pred: pd.DataFrame, path: Path, mode: str) -> None:
    """Versi JSON dari prediksi.csv untuk dibaca aplikasi web (NaN -> null)."""
    rows = pred.astype({"tanggal_terakhir": str, "tanggal_target": str})
    rows = rows.astype(object).where(rows.notna(), None).to_dict(orient="records")
    path.write_text(json.dumps({"mode": mode, "dibuat": pd.Timestamp.now().isoformat(timespec="seconds"),
                                "prediksi": rows}, ensure_ascii=False, indent=2), encoding="utf-8")


def run(csv_path, out_dir="output", paksa: bool = False):
    """Jalankan pipeline penuh. Green IT: bila CSV DAN kode src/harga/*.py tidak berubah
    (hash sama) dan output sudah ada, hasil di-cache (tidak retrain) kecuali paksa=True."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    meta_path, pred_path = out_dir / "cache_meta.json", out_dir / "prediksi.csv"
    h, hk = _hash(csv_path), _hash_kode()
    if not paksa and meta_path.exists() and pred_path.exists():
        meta = json.loads(meta_path.read_text())
        if meta.get("sha256") == h and meta.get("kode_sha256") == hk:
            return {"prediksi": pd.read_csv(pred_path), "mode": meta["mode"], "dari_cache": True}
    raw = load_csv(csv_path)
    clean = bersihkan(raw)
    tgl_target = clean.loc[(clean["sumber_id"] == C.SUMBER_TARGET), "tanggal"]
    freq = deteksi_frekuensi(tgl_target)
    if freq == "harian":
        pred, detail = jalankan_mode_harian(clean, out_dir)
    else:
        pred, detail = jalankan_bulanan(clean, out_dir)
    pred.to_csv(pred_path, index=False)
    tulis_json(pred, out_dir / "prediksi.json", freq)
    meta_path.write_text(json.dumps({"sha256": h, "kode_sha256": hk, "mode": freq, "csv": str(csv_path),
                                     "dibuat": pd.Timestamp.now().isoformat(timespec="seconds")},
                                    indent=2))
    return {"prediksi": pred, "mode": freq, "clean": clean, "detail": detail, "dari_cache": False}
