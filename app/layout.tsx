import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GroUp — Patungan bahan baku UMKM",
  description:
    "Gabungkan kebutuhan bahan baku bersama usaha sekitar dan capai harga grosir dalam satu batch.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
