import { describe, expect, it } from "vitest";
import { extractNumbers, isGrounded } from "./grounding";

describe("extractNumbers", () => {
  it.each([
    ["Rp12.000", [12000]],
    ["2,5 kg", [2.5]],
    ["1.000 kg dan 2.5 liter", [1000, 2.5]],
    ["Rp 1.250.000,50", [1250000.5]],
    ["tanpa angka", []],
  ])("%s", (text, expected) => {
    expect(extractNumbers(text)).toEqual(expected);
  });
});

describe("isGrounded", () => {
  const tool = [{ harga: [{ mulai_dari: 50, harga_per_satuan: 12000 }], tutup: "2026-11-15T03:00:00.000Z" }];

  it("true untuk jawaban yang angkanya ada di tool", () => {
    expect(isGrounded("Harganya Rp12.000/kg, tutup 15 November", tool)).toBe(true);
  });

  it("false untuk harga yang tidak ada di tool", () => {
    expect(isGrounded("Rp9.000/kg", tool)).toBe(false);
  });

  it("true untuk angka kecil tanpa Rp seperti jumlah hari", () => {
    expect(isGrounded("sisa 3 hari", [])).toBe(true);
  });

  it("false untuk Rp kecil yang tidak ada di tool", () => {
    expect(isGrounded("cuma Rp5 kok", [])).toBe(false);
  });

  it("false untuk nama bulan yang tidak cocok dengan tanggal di tool", () => {
    const price = [{ harga_per_satuan: 45000, tanggal: "2026-11-02", tanggal_teks: "2 November 2026" }];
    expect(isGrounded("Rp45.000 per tanggal 2 Maret 2026", price)).toBe(false);
    expect(isGrounded("Rp45.000 per tanggal 2 November 2026", price)).toBe(true);
  });

  it("menerima bulan WIB dari timestamp UTC di akhir bulan", () => {
    expect(isGrounded("tutup 1 Desember", [{ tutup: "2026-11-30T20:00:00.000Z" }])).toBe(true);
  });

  it("false untuk nama bulan tanpa data tool", () => {
    expect(isGrounded("datanya per Maret", [])).toBe(false);
  });

  it("false untuk angka besar tanpa Rp yang tidak ada di tool", () => {
    expect(isGrounded("minimal 75 kg", tool)).toBe(false);
  });
});
