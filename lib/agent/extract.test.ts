import { describe, expect, it } from "vitest";
import type { Batch } from "@/lib/batch";
import type { ManagedOrder } from "@/lib/orders";
import { FIXTURE_BATCHES } from "@/test/fixtures/batches";
import { extractSlots, matchBatches, matchOrder, normalizedDistance, parseQuantity, toBatchUnit } from "./extract";

const byName = (name: string) => FIXTURE_BATCHES.find((batch) => batch.name.startsWith(name))!;

const AYAM: Batch = { ...byName("Bawang"), id: "00000000-0000-4000-8000-000000000009", name: "Daging Ayam Ras" };

const order = (id: string, batch: Batch, quantity = 3): ManagedOrder => ({
  id,
  customerName: "Pembeli",
  quantity,
  status: "confirmed",
  paymentStatus: "not_due",
  fulfillmentStatus: "pending",
  finalUnitPrice: null,
  createdAt: "2026-11-09T00:00:00.000Z",
  batch,
  editable: true,
});

describe("parseQuantity", () => {
  it.each([
    ["5", { value: 5, unit: null }],
    ["2,5 kg", { value: 2.5, unit: "kg" }],
    ["2.5 kilo", { value: 2.5, unit: "kg" }],
    ["1.000 kg", { value: 1000, unit: "kg" }],
    ["2.500", { value: 2500, unit: null }],
    ["setengah kilo", { value: 0.5, unit: "kg" }],
    ["sekilo", { value: 1, unit: "kg" }],
    ["1/2 kg", { value: 0.5, unit: "kg" }],
    ["lima sak", { value: 5, unit: "sak" }],
    ["500 gram", { value: 500, unit: "gram" }],
    ["3 ons", { value: 3, unit: "ons" }],
    ["mau ikut cabe 5kg ya", { value: 5, unit: "kg" }],
    ["seliter aja", { value: 1, unit: "liter" }],
    ["kode ab12cd", null],
    ["mau ikut dong", null],
  ])("%s", (input, expected) => {
    expect(parseQuantity(input)).toEqual(expected);
  });
});

describe("toBatchUnit", () => {
  it.each([
    [{ value: 500, unit: "gram" }, "kg", 0.5],
    [{ value: 3, unit: "ons" }, "kg", 0.3],
    [{ value: 2, unit: "karung" }, "kg", null],
    [{ value: 2, unit: null }, "sak", 2],
    [{ value: 4, unit: "kg" }, "kg", 4],
    [{ value: 2, unit: "kg" }, "liter", null],
  ])("%o ke %s", (quantity, unit, expected) => {
    expect(toBatchUnit(quantity, unit)).toBe(expected);
  });
});

describe("matchBatches", () => {
  const names = (text: string) => matchBatches(text, FIXTURE_BATCHES).map((batch) => batch.name);

  it.each([
    ["cabe 5 kilo", ["Cabai Merah Keriting"]],
    ["bawmer 2", ["Bawang Merah"]],
    ["terigu protein tinggi", ["Tepung Terigu Protein Tinggi"]],
    ["tepug terigu", ["Tepung Terigu Protein Tinggi"]],
    ["gula 3 kg", []],
    ["minyak 10 liter", ["Minyak Goreng"]],
    ["mau ikut dong", []],
  ])("%s", (text, expected) => {
    expect(names(text)).toEqual(expected);
  });

  it("cabe sama bawang menghasilkan 2 batch", () => {
    expect(names("cabe sama bawang").sort()).toEqual(["Bawang Merah", "Cabai Merah Keriting"]);
  });

  it("kata yang dimiliki dua batch saja tidak dianggap satu batch", () => {
    expect(names("yang merah 5 kg").sort()).toEqual(["Bawang Merah", "Cabai Merah Keriting"]);
  });
});

describe("matchOrder", () => {
  const cabai = byName("Cabai");

  it("kode eksplisit cocok tanpa melihat huruf besar/kecil", () => {
    const own = order("ab12cd00-0000-4000-8000-000000000001", cabai);
    expect(matchOrder("ubah ab12cd jadi 5", [own])).toBe(own);
  });

  it("satu pesanan berbahan cocok dipakai tanpa kode", () => {
    const ayam = order("ffff0000-0000-4000-8000-000000000001", AYAM);
    const other = order("eeee0000-0000-4000-8000-000000000001", cabai);
    expect(matchOrder("ayam aku jadiin 8", [ayam, other])).toBe(ayam);
  });

  it("dua pesanan cabai dianggap ambigu", () => {
    const a = order("aaaa0000-0000-4000-8000-000000000001", cabai);
    const b = order("bbbb0000-0000-4000-8000-000000000001", cabai);
    expect(matchOrder("cabe aku jadiin 8", [a, b])).toBeNull();
  });

  it("kode milik orang lain tidak cocok walau bahannya cocok", () => {
    const own = order("aaaa0000-0000-4000-8000-000000000001", cabai);
    expect(matchOrder("ubah cabe 9z9z9z jadi 5", [own])).toBeNull();
  });

  it("pesanan yang tidak bisa diubah diabaikan", () => {
    const locked = { ...order("aaaa0000-0000-4000-8000-000000000001", cabai), editable: false };
    expect(matchOrder("cabe jadiin 8", [locked])).toBeNull();
  });
});

describe("extractSlots", () => {
  it("kode pesanan berangka tidak dibaca sebagai jumlah", () => {
    const own = order("123456aa-0000-4000-8000-000000000001", byName("Cabai"));
    const slots = extractSlots("ubah 123456 jadi 7 kg", { batches: FIXTURE_BATCHES, orders: [own] });
    expect(slots.order).toBe(own);
    expect(slots.quantity).toEqual({ value: 7, unit: "kg" });
  });

  it("menggabungkan batch dan jumlah", () => {
    const slots = extractSlots("mau ikut cabe 500 gram", { batches: FIXTURE_BATCHES, orders: [] });
    expect(slots.batches.map((batch) => batch.name)).toEqual(["Cabai Merah Keriting"]);
    expect(slots.quantity).toEqual({ value: 500, unit: "gram" });
    expect(slots.order).toBeNull();
  });
});

describe("normalizedDistance", () => {
  it.each([
    ["cabai", "cabai", 0],
    ["Cabai ", "cabai", 0],
    ["tepug", "tepung", 1 / 6],
    ["", "", 0],
  ])("%s vs %s", (a, b, expected) => {
    expect(normalizedDistance(a, b)).toBeCloseTo(expected);
  });
});
