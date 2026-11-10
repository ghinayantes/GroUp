import { describe, expect, it } from "vitest";
import { batchImagePath, fitWithin, imageInputError, isOwnedImagePath } from "./batch-image";

const U = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ID = "00000000-0000-4000-8000-000000000001";
const TYPE_ERROR = "Gunakan foto JPG, PNG, atau WebP.";

describe("batch-image", () => {
  it("isOwnedImagePath menerima path milik user", () => {
    expect(isOwnedImagePath(batchImagePath(U, ID), U)).toBe(true);
  });

  it("isOwnedImagePath menolak path milik user lain, traversal, ekstensi lain, id bukan uuid, dan awalan /", () => {
    expect(isOwnedImagePath(batchImagePath(OTHER, ID), U)).toBe(false);
    expect(isOwnedImagePath(`${U}/../${ID}.webp`, U)).toBe(false);
    expect(isOwnedImagePath(`${U}/${ID}.png`, U)).toBe(false);
    expect(isOwnedImagePath(`${U}/bukan-uuid.webp`, U)).toBe(false);
    expect(isOwnedImagePath(`/${U}/${ID}.webp`, U)).toBe(false);
  });

  it("imageInputError menolak HEIC dan non-gambar", () => {
    expect(imageInputError({ type: "image/heic", size: 1 })).toBe(TYPE_ERROR);
    expect(imageInputError({ type: "application/pdf", size: 1 })).toBe(TYPE_ERROR);
  });

  it("imageInputError menolak file lebih dari 20 MB dan menerima file wajar", () => {
    expect(imageInputError({ type: "image/jpeg", size: 20 * 1024 * 1024 + 1 })).toBe("Ukuran foto maksimal 20 MB.");
    expect(imageInputError({ type: "image/png", size: 1000 })).toBeNull();
  });

  it("fitWithin menskalakan dengan rasio tetap dan tidak memperbesar", () => {
    expect(fitWithin(12000, 9000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(900, 3000)).toEqual({ width: 480, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
