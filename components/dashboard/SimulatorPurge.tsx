"use client";

import { send, useAction } from "@/components/dashboard/client";
import type { DashboardBatch } from "@/lib/dashboard-data";

export default function SimulatorPurge({ batches }: { batches: DashboardBatch[] }) {
  const { busy, message, run } = useAction();
  const active = batches.filter((batch) => batch.status === "open").flatMap((batch) => batch.orders).filter((order) => order.channel === "simulator" && order.status === "confirmed").length;

  function purge() {
    if (!window.confirm(`Hapus semua pesanan simulator di batch yang masih terbuka (${active} pesanan aktif)? Progres batch akan turun dan tindakan ini tidak bisa dibatalkan.`)) return;
    run(() => send("/api/admin/simulator-orders", "DELETE") as Promise<{ deleted: number }>, ({ deleted }) => `${deleted} pesanan simulator dihapus.`);
  }

  return <div className="admin-sim-tools">
    <button className="button button-outline" disabled={busy} onClick={purge}>{busy ? "Menghapus…" : "Hapus pesanan simulator"}</button>
    <small>{active} pesanan simulator aktif di batch terbuka.</small>
    {message && <p className="admin-message" role="status">{message}</p>}
  </div>;
}
