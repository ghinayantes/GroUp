"""Latih ulang model harga dan tulis output/prediksi.{csv,json}.

Pemakaian: python train.py [--csv PATH] [--out DIR] [--paksa]
"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))

from harga import run  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--csv", type=Path, default=ROOT / "dataset" / "dataset_gabungan_komoditas_2026.csv")
    ap.add_argument("--out", type=Path, default=ROOT / "output")
    ap.add_argument("--paksa", action="store_true", help="abaikan cache dan latih ulang")
    a = ap.parse_args()
    hasil = run(a.csv, out_dir=a.out, paksa=a.paksa)
    p = hasil["prediksi"]
    asal = "cache" if hasil["dari_cache"] else "latih ulang"
    print(f"Mode {hasil['mode']} ({asal}): {len(p)} prediksi -> {a.out}")
    print(p[["komoditas", "harga_terakhir", "prediksi", "status"]].to_string(index=False))


if __name__ == "__main__":
    main()
