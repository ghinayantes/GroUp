import { describe, expect, it } from "vitest";
import { redact } from "./redact";

describe("redact", () => {
  it.each([
    ["wa aku 0812-3456-7890 ya", "wa aku [NOMOR] ya"],
    ["+62 812 3456 7890", "[NOMOR]"],
    ["hubungi 6281234567890", "hubungi [NOMOR]"],
    ["email budi@toko.id", "email [EMAIL]"],
    ["rek 1234567890123", "rek [ANGKA]"],
    ["kartu 4111 1111 1111 1111", "kartu [ANGKA]"],
    ["pesan 1.000 kg", "pesan 1.000 kg"],
    ["2500", "2500"],
    ["kode AB12CD", "kode AB12CD"],
    ["harga Rp12.000.000", "harga Rp12.000.000"],
  ])("%s", (input, expected) => {
    expect(redact(input)).toBe(expected);
  });
});

describe("redact nomor bertitik", () => {
  it("0812.3456.7890 → [NOMOR], harga bertitik tidak berubah", () => {
    expect(redact("hub 0812.3456.7890 ya")).toBe("hub [NOMOR] ya");
    expect(redact("Rp1.250.000.000")).toBe("Rp1.250.000.000");
  });
});
