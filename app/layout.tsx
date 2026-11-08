import type { Metadata } from "next";
import { Fredoka } from "next/font/google";
import "./globals.css";

const brandFont = Fredoka({ subsets: ["latin"], variable: "--font-brand" });

export const metadata: Metadata = {
  title: "GroUp — Patungan bahan baku UMKM",
  description:
    "Gabungkan kebutuhan bahan baku bersama usaha sekitar dan capai harga grosir dalam satu batch.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={brandFont.variable}>
      <body>{children}</body>
    </html>
  );
}
