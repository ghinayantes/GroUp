import type { Batch } from "@/lib/batch";

export const FIXTURE_NOW = new Date("2026-11-10T03:00:00.000Z");

const DAY_MS = 86_400_000;
const inDays = (days: number) => new Date(FIXTURE_NOW.getTime() + days * DAY_MS).toISOString();

const base = {
  supplier: "Mitra Tani Contoh",
  verified: true,
  supplierCompletedBatches: 5,
  image: "",
  color: "#ead7c4",
  current: 0,
  status: "open",
  acceptingOrders: true,
  paymentInstructions: "Transfer ke rekening yang dikirim admin setelah kuota tercapai.",
  fulfillmentPlan: "Barang diambil di titik kumpul yang diumumkan admin.",
  finalUnitPrice: null,
} satisfies Partial<Batch>;

export const FIXTURE_BATCHES: Batch[] = [
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000001",
    name: "Cabai Merah Keriting",
    category: "Sayur & Bumbu",
    unit: "kg",
    minimum: 100,
    closesAt: inDays(3),
    tiers: [
      { minQuantity: 50, unitPrice: 42_000 },
      { minQuantity: 100, unitPrice: 38_000 },
    ],
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000002",
    name: "Bawang Merah",
    category: "Sayur & Bumbu",
    unit: "kg",
    minimum: 80,
    closesAt: inDays(3),
    tiers: [
      { minQuantity: 40, unitPrice: 36_000 },
      { minQuantity: 80, unitPrice: 33_000 },
    ],
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000003",
    name: "Tepung Terigu Protein Tinggi",
    category: "Bahan Kue",
    unit: "sak",
    minimum: 40,
    closesAt: inDays(3),
    tiers: [
      { minQuantity: 20, unitPrice: 210_000 },
      { minQuantity: 40, unitPrice: 195_000 },
    ],
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000004",
    name: "Minyak Goreng",
    category: "Sembako",
    unit: "liter",
    minimum: 200,
    closesAt: inDays(3),
    tiers: [
      { minQuantity: 100, unitPrice: 18_500 },
      { minQuantity: 200, unitPrice: 17_000 },
    ],
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000005",
    name: "Gula Pasir",
    category: "Sembako",
    unit: "kg",
    minimum: 100,
    status: "open",
    acceptingOrders: false,
    closesAt: inDays(-1),
    tiers: [
      { minQuantity: 50, unitPrice: 17_500 },
      { minQuantity: 100, unitPrice: 16_500 },
    ],
  },
];
