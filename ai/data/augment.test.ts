import { describe, expect, it } from "vitest";
import { augment, mulberry32 } from "./augment";

describe("augment", () => {
  it("deterministik untuk seed sama dan tidak pernah mengembalikan teks asli", () => {
    const texts = ["mau ikut cabe 5 kg dong kak!", "berapa harganya kak", "halo", "ok", "Yang kemarin sudah saya bayar."];
    for (const text of texts) {
      const a = augment(text, mulberry32(7));
      const b = augment(text, mulberry32(7));
      expect(a).toEqual(b);
      expect(a).not.toContain(text);
      expect(new Set(a).size).toBe(a.length);
    }
  });

  it('augment "berapa harganya kak" mengandung varian "brp harganya kak"', () => {
    expect(augment("berapa harganya kak", mulberry32(1))).toContain("brp harganya kak");
  });

  it("menghasilkan 3 varian untuk kalimat biasa", () => {
    expect(augment("Mau ikut cabai merah, 5 kilo ya.", mulberry32(3))).toHaveLength(3);
  });

  it("mulberry32 menghasilkan bilangan di [0, 1)", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
