import type { Batch } from "@/lib/batch";

export type { Batch } from "@/lib/batch";

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

const demoPayment = "Pembayaran diminta lewat WhatsApp setelah batch berhasil ditutup, transfer ke rekening pengelola paling lambat 2 hari.";

/** Data contoh untuk pratinjau tanpa Supabase. Angka tidak mewakili harga atau penghematan nyata. */
export const demoBatches: Batch[] = [
  {
    id: "ayam", name: "Ayam fillet segar", category: "Protein", unit: "kg", supplierId: "", supplier: "Contoh Supplier Unggas", verified: true, supplierCompletedBatches: 0,
    image: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=960&q=85", color: "#ead7c4",
    current: 74, minimum: 100, closesAt: inDays(2), status: "open", acceptingOrders: true,
    tiers: [{ minQuantity: 100, unitPrice: 38_500 }, { minQuantity: 150, unitPrice: 35_900 }],
    paymentInstructions: demoPayment, fulfillmentPlan: "Ambil di titik kumpul pasar setempat, Sabtu 08.00–11.00.", finalUnitPrice: null, fairPrice: null,
  },
  {
    id: "cabai", name: "Cabai merah keriting", category: "Sayuran", unit: "kg", supplierId: "", supplier: "Contoh Koperasi Tani", verified: true, supplierCompletedBatches: 0,
    image: "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&w=960&q=85", color: "#f3d1c2",
    current: 128, minimum: 150, closesAt: inDays(4), status: "open", acceptingOrders: true,
    tiers: [{ minQuantity: 150, unitPrice: 42_000 }, { minQuantity: 250, unitPrice: 39_500 }],
    paymentInstructions: demoPayment, fulfillmentPlan: "Diantar ke alamat usaha dalam satu kecamatan, Senin pagi.", finalUnitPrice: null, fairPrice: null,
  },
  {
    id: "tepung", name: "Tepung terigu protein tinggi", category: "Bahan kering", unit: "sak", supplierId: "", supplier: "Contoh Distributor Pangan", verified: false, supplierCompletedBatches: 0,
    image: "https://images.unsplash.com/photo-1627485937980-221c88ac04f9?auto=format&fit=crop&w=960&q=85", color: "#e9dfc8",
    current: 42, minimum: 60, closesAt: inDays(5), status: "open", acceptingOrders: true,
    tiers: [{ minQuantity: 60, unitPrice: 218_000 }, { minQuantity: 100, unitPrice: 205_000 }],
    paymentInstructions: demoPayment, fulfillmentPlan: "Ambil di gudang distributor, Jumat 13.00–16.00.", finalUnitPrice: null, fairPrice: null,
  },
];
