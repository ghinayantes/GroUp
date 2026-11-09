import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

const DIR = import.meta.dirname;
const VENV_PYTHON = path.join(DIR, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const PYTHON = existsSync(VENV_PYTHON) ? VENV_PYTHON : process.platform === "win32" ? "python" : "python3";
const TIMEOUT_MS = 600_000;

it.skipIf(process.env.SKIP_PYTEST === "1")(
  "pytest pipeline harga (ai/harga/tests) lulus",
  () => {
    const result = spawnSync(PYTHON, ["-m", "pytest", "-q", "tests"], { cwd: DIR, encoding: "utf8", timeout: TIMEOUT_MS });
    expect(result.error, `Python tidak bisa dijalankan (${PYTHON}). Setup: lihat ai/harga/README.md`).toBeUndefined();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  },
  TIMEOUT_MS,
);
