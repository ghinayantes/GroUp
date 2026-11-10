import { DashHeader } from "@/components/dashboard/Shell";
import SupplierPanel from "@/components/dashboard/SupplierPanel";
import { requireRole } from "@/lib/auth";
import { listSuppliers } from "@/lib/dashboard-data";

export default async function AdminSuppliers() {
  await requireRole("admin");
  return <>
    <DashHeader eyebrow="SUPPLIER" title="Verifikasi supplier" />
    <SupplierPanel suppliers={await listSuppliers()} />
  </>;
}
