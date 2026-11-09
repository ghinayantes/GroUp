import type { Intent } from "@/lib/agent/types";

export const INTENT_DEFINITIONS: Record<Intent, string> = {
  pesan_baru: "ingin ikut/memesan di batch patungan yang sedang buka, boleh menyebut bahan dan jumlah",
  ubah_pesanan: "ingin mengubah jumlah pesanan yang sudah dibuat (tambah, kurangi, jadikan sekian)",
  batal_pesanan: "ingin membatalkan pesanan yang sudah dibuat",
  cek_pesanan: "ingin melihat daftar/status pesanannya sendiri",
  tanya_info: "bertanya aturan batch: harga batch, pembayaran, pengambilan/pengiriman, deadline, minimum, cara kerja",
  tanya_harga_pasar: "membandingkan harga batch dengan harga pasar, atau bertanya harga pasar suatu bahan",
  catat_minat: "menyatakan butuh bahan secara rutin/sekali yang belum ada batch-nya, agar dicatat sebagai minat",
  sapaan: "hanya menyapa atau basa-basi pembuka tanpa permintaan",
  di_luar_topik: "permintaan di luar patungan bahan baku (puisi, politik, PR sekolah, gosip, dll.)",
};
