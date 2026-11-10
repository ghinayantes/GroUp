"""Test pipeline. Data harian di sini SINTETIS, hanya untuk membuktikan kode mode harian
berjalan; tidak pernah dipakai sebagai hasil prediksi."""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from harga import config as C  # noqa: E402
from harga.clean import bersihkan, kanonikkan_nama  # noqa: E402
from harga.daily import pilih_model_harian  # noqa: E402
from harga.features import buat_fitur, ke_harian  # noqa: E402
from harga.load import deteksi_frekuensi  # noqa: E402
from harga.models import Naive, interval_empiris, pilih_model, walk_forward  # noqa: E402
from harga.predict import run, status_dari, tulis_json  # noqa: E402

CSV_ASLI = ROOT / "dataset" / "dataset_gabungan_komoditas_2026.csv"


def _sintetis_harian(n_hari=200, seed=0):
    rng = np.random.default_rng(seed)
    tgl = pd.date_range("2026-01-01", periods=n_hari, freq="D")
    rows = []
    for i, kom in enumerate(C.TARGET_KOMODITAS):
        harga = 20000 * (1 + i) * np.exp(np.cumsum(rng.normal(0, 0.01, n_hari)))
        for t, h in zip(tgl, harga):
            if rng.random() < 0.05:   # celah acak
                continue
            rows.append((t.date().isoformat(), kom, "kg", round(h), "eceran", "PIHPS"))
    return pd.DataFrame(rows, columns=["tanggal", "komoditas", "satuan", "harga",
                                       "jenis_harga", "sumber_id"])


def test_deteksi_frekuensi():
    assert deteksi_frekuensi(pd.date_range("2026-01-01", periods=10, freq="D")) == "harian"
    assert deteksi_frekuensi(pd.date_range("2026-01-01", periods=10, freq="MS")) == "bulanan"


def test_alias_identik_dilebur_bukan_digandakan():
    df = pd.DataFrame({"tanggal": pd.to_datetime(["2026-01-01"] * 2), "komoditas": ["telur_ayam", "telur_ayam_ras"],
                       "satuan": "kg", "harga": [30000.0, 30000.0], "jenis_harga": "eceran", "sumber_id": "PIHPS"})
    out = kanonikkan_nama(df)
    assert list(out["komoditas"]) == ["telur_ayam_ras"]


def test_ffill_maks_3_hari_dan_flag_imputed():
    df = pd.DataFrame({"tanggal": pd.to_datetime(["2026-01-01", "2026-01-10"]),
                       "komoditas": "x", "harga": [100.0, 200.0]})
    d = ke_harian(df)
    assert len(d) == 10
    assert d["is_imputed"].sum() == 3
    assert d["harga"].isna().sum() == 5      # celah > 3 hari tidak dikarang


def test_walk_forward_tidak_bocor():
    dilihat = []

    class Spy(Naive):
        def fit(self, y):
            dilihat.append(len(y))
            return super().fit(y)

    y = np.arange(10, dtype=float)
    wf = walk_forward(y, Spy, min_train=4)
    assert dilihat == [4, 5, 6, 7, 8, 9]
    assert list(wf["idx_uji"]) == [4, 5, 6, 7, 8, 9]


def test_fitur_hanya_pakai_masa_lalu():
    df = pd.DataFrame({"tanggal": pd.date_range("2026-01-01", periods=40), "komoditas": "x",
                       "harga": np.arange(40, dtype=float) + 100, "is_imputed": False})
    f = buat_fitur(df, h=7)
    baris = f.iloc[20]
    assert baris["lag_1"] == baris["harga"] - 1
    assert baris["target"] == baris["harga"] + 7


def test_model_hanya_dipakai_bila_kalahkan_baseline():
    t = pd.DataFrame({"model": ["naive", "ses"], "MAE": [10.0, 10.0]})
    assert pilih_model(t) == "naive"
    t2 = pd.DataFrame({"model": ["naive", "ses"], "MAE": [10.0, 9.0]})
    assert pilih_model(t2) == "ses"
    r = pd.DataFrame({"model": ["lightgbm", "naive", "ma7"], "MAE": [5.0, 4.0, 6.0]})
    assert pilih_model_harian(r) == "naive"


def test_interval_mengapit_prediksi_dan_status():
    lo, hi = interval_empiris(100.0, np.array([5.0, 6.0, 7.0]))
    assert lo <= 100.0 <= hi
    assert status_dari(100, 106) == "NAIK" and status_dari(100, 94) == "TURUN"
    assert status_dari(100, 104) == "STABIL"


@pytest.mark.skipif(not CSV_ASLI.exists(), reason="CSV asli tidak ada")
def test_end_to_end_bulanan_data_asli(tmp_path):
    r = run(CSV_ASLI, out_dir=tmp_path, paksa=True)
    assert r["mode"] == "bulanan"
    p = r["prediksi"]
    assert set(p["komoditas"]) == set(C.TARGET_KOMODITAS)
    assert (p["batas_bawah"] <= p["prediksi"]).all() and (p["prediksi"] <= p["batas_atas"]).all()
    assert len(list(tmp_path.glob("*.joblib"))) == len(C.TARGET_KOMODITAS)
    assert run(CSV_ASLI, out_dir=tmp_path)["dari_cache"] is True


@pytest.mark.skipif(not CSV_ASLI.exists(), reason="CSV asli tidak ada")
def test_prediksi_json_sama_dengan_csv(tmp_path):
    import json
    p = run(CSV_ASLI, out_dir=tmp_path, paksa=True)["prediksi"]
    data = json.loads((tmp_path / "prediksi.json").read_text(encoding="utf-8"))
    assert data["mode"] == "bulanan"
    assert [r["komoditas"] for r in data["prediksi"]] == list(p["komoditas"])
    assert all(isinstance(r["prediksi"], int) and r["tanggal_target"] == "2026-12-01" for r in data["prediksi"])


def test_tulis_json_tanggal_kosong_jadi_null_dan_ada_skema(tmp_path):
    pred = pd.DataFrame({"komoditas": ["cabai"], "tanggal_terakhir": [pd.NaT],
                         "tanggal_target": pd.to_datetime(["2026-12-01"]), "prediksi": [1000]})
    tulis_json(pred, tmp_path / "p.json", "bulanan")
    data = json.loads((tmp_path / "p.json").read_text(encoding="utf-8"))
    assert data["skema"] == 1
    assert data["dibuat"].endswith("+07:00")
    assert data["prediksi"][0]["tanggal_terakhir"] is None
    assert data["prediksi"][0]["tanggal_target"] == "2026-12-01"


def test_end_to_end_harian_sintetis(tmp_path):
    csv = tmp_path / "harian.csv"
    _sintetis_harian().to_csv(csv, index=False)
    r = run(csv, out_dir=tmp_path / "out", paksa=True)
    assert r["mode"] == "harian"
    p = r["prediksi"]
    assert set(p["horizon"]) == {"1_hari", "7_hari"}
    assert len(p) == 2 * len(C.TARGET_KOMODITAS)
    for h in C.HORIZON_HARIAN:
        ringkas = r["detail"]["hasil"][h]["ringkas"]
        assert set(ringkas["model"]) == {"lightgbm", "naive", "ma7"}
    assert (tmp_path / "out" / "model_harian_h1.joblib").exists()


def test_bersihkan_minyak_liter_tetap_rp_per_liter():
    df = pd.DataFrame({"tanggal": pd.to_datetime(["2026-05-01"]), "komoditas": ["minyakita"],
                       "satuan": ["liter"], "harga": [15700.0], "jenis_harga": ["eceran"],
                       "sumber_id": ["sp2kp_databoks"]})
    out = bersihkan(df)
    assert out["satuan"].iloc[0] == "liter"
    assert out["harga"].iloc[0] == 15700
    assert not hasattr(C, "DENSITAS_MINYAK_KG_PER_L")


def test_output_mencantumkan_satuan_sumber(tmp_path):
    p = run(CSV_ASLI, out_dir=tmp_path, paksa=True)["prediksi"]
    assert "satuan" in p.columns
    satuan = dict(zip(p["komoditas"], p["satuan"]))
    # PIHPS menerbitkan minyak goreng curah per kg; satuan sumber dipertahankan tanpa konversi densitas.
    assert satuan["minyak_goreng_curah"] == "kg"
    assert set(satuan.values()) <= {"kg", "liter"}
    js = json.loads((tmp_path / "prediksi.json").read_text(encoding="utf-8"))
    assert all("satuan" in row for row in js["prediksi"])


# --- Aturan status, margin model, lebar interval (perbaikan Nov 2026) ---

@pytest.mark.parametrize("last,pred,lo,hi", [
    (94100, 72933, 61520, 103447),   # kasus cabai_merah_keriting: turun 22% tapi interval memuat harga terakhir
    (100, 120, 95, 140),             # naik 20%, interval memuat harga terakhir
    (100, 80, 60, 100),              # tepat di batas atas
    (100, 120, 100, 130),            # tepat di batas bawah
])
def test_interval_memuat_harga_terakhir_tidak_pernah_naik_turun(last, pred, lo, hi):
    assert status_dari(last, pred, lo, hi) not in {"NAIK", "TURUN"}
    assert status_dari(last, pred, lo, hi) == "TIDAK PASTI"


def test_naik_turun_hanya_bila_seluruh_interval_di_satu_sisi():
    assert status_dari(100, 120, 105, 130) == "NAIK"
    assert status_dari(100, 80, 70, 95) == "TURUN"
    assert status_dari(100, 103, 101, 106) == "STABIL"          # interval di atas, tapi < 5%
    assert status_dari(100, 80, np.nan, np.nan) == "TIDAK PASTI"


def test_saran_netral_bila_mape_tinggi():
    from harga.predict import saran_dari
    s = saran_dari("TURUN", "cabai_merah_keriting", 0.5, mape=22.8)
    assert s == "Harga bergejolak, beli sesuai kebutuhan"
    assert "Tunda" not in s and "Stok" not in s


@pytest.mark.parametrize("mae_kandidat", [9.8, 9.5, 9.01])
def test_model_kurang_dari_margin_tidak_terpilih(mae_kandidat):
    t = pd.DataFrame({"model": ["naive", "ma3", "ses"], "MAE": [10.0, mae_kandidat, 10.5]})
    assert C.MARGIN_MENANG_NAIVE == pytest.approx(0.10)
    assert pilih_model(t) == "naive"


def test_lebar_interval_minimal_1_persen():
    for pred, res in [(15900.0, np.zeros(7)), (19300.0, np.array([0, 0, 0, 50, 0, 0, 290.0])),
                      (100.0, np.array([-0.1, 0.1]))]:
        lo, hi = interval_empiris(pred, res)
        assert lo <= pred * (1 - C.LEBAR_MIN_INTERVAL) + 1e-6
        assert hi >= pred * (1 + C.LEBAR_MIN_INTERVAL) - 1e-6


@pytest.mark.skipif(not CSV_ASLI.exists(), reason="CSV asli tidak ada")
def test_output_hanya_berisi_model_target(tmp_path):
    (tmp_path / "model_bulanan_komoditas_lama.joblib").write_bytes(b"x")
    run(CSV_ASLI, out_dir=tmp_path, paksa=True)
    nama = {p.name for p in tmp_path.glob("model_bulanan_*.joblib")}
    assert nama == {f"model_bulanan_{k}.joblib" for k in C.TARGET_KOMODITAS}


# --- Status BERGEJOLAK ---

@pytest.mark.parametrize("last,pred,lo,hi", [
    (100, 100, 99, 101),     # akan STABIL tanpa mape
    (100, 120, 105, 130),    # akan NAIK tanpa mape
    (100, 80, 70, 95),       # akan TURUN tanpa mape
    (100, 120, 95, 140),     # akan TIDAK PASTI tanpa mape
])
def test_bergejolak_dicek_paling_dulu(last, pred, lo, hi):
    mape = C.AMBANG_MAPE_BERGEJOLAK * 100 + 0.01   # mape_validasi dalam persen
    assert status_dari(last, pred, lo, hi, mape) == "BERGEJOLAK"
    assert status_dari(last, pred, lo, hi, C.AMBANG_MAPE_BERGEJOLAK * 100) != "BERGEJOLAK"


def test_ambang_bergejolak_10_persen_bawang_merah_tidak_lolos():
    assert C.AMBANG_MAPE_BERGEJOLAK == pytest.approx(0.10)
    assert status_dari(35000, 35000, 26000, 41100, 14.98) == "BERGEJOLAK"


@pytest.mark.skipif(not CSV_ASLI.exists(), reason="CSV asli tidak ada")
def test_output_bergejolak_tidak_pernah_beli_seperti_biasa(tmp_path):
    p = run(CSV_ASLI, out_dir=tmp_path, paksa=True)["prediksi"]
    g = p[p["mape_validasi"] > C.AMBANG_MAPE_BERGEJOLAK * 100]
    assert len(g) > 0 and (g["status"] == "BERGEJOLAK").all()
    assert not g["saran"].str.contains("Beli seperti biasa").any()
    assert (p.loc[p["status"] == "BERGEJOLAK", "saran"] == "Harga bergejolak, beli sesuai kebutuhan").all()


# --- Cache harus ikut kode, bukan hanya CSV ---

@pytest.mark.skipif(not CSV_ASLI.exists(), reason="CSV asli tidak ada")
def test_cache_tidak_valid_bila_kode_berubah(tmp_path, monkeypatch):
    import shutil
    from harga import predict as P
    kode = tmp_path / "kode"
    shutil.copytree(ROOT / "src" / "harga", kode, ignore=shutil.ignore_patterns("__pycache__"))
    monkeypatch.setattr(P, "KODE_DIR", kode)
    out = tmp_path / "out"
    assert run(CSV_ASLI, out_dir=out)["dari_cache"] is False
    assert run(CSV_ASLI, out_dir=out)["dari_cache"] is True          # CSV & kode sama -> cache
    with open(kode / "config.py", "a", encoding="utf-8") as f:
        f.write("\n# ubah konstanta\n")
    assert run(CSV_ASLI, out_dir=out)["dari_cache"] is False         # kode berubah -> retrain
    assert run(CSV_ASLI, out_dir=out)["dari_cache"] is True
