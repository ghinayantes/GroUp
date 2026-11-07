import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BatchDetail from "@/components/BatchDetail";
import { getBatch } from "@/lib/orders";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const batch = await getBatch((await params).id).catch(() => null);
  return { title: batch ? `${batch.name} — Patungan GroUp` : "Patungan tidak ditemukan — GroUp" };
}

export default async function BatchPage({ params }: Props) {
  const batch = await getBatch((await params).id);
  if (!batch) notFound();
  return <BatchDetail batch={batch} whatsappNumber={process.env.NEXT_PUBLIC_WHATSAPP_NUMBER} />;
}
