import { redirect } from "next/navigation";
import AdminDashboard from "@/components/AdminDashboard";
import { listAdminBatches, listSuppliers, type AdminBatch, type AdminSupplier } from "@/lib/admin";
import { isCurrentUserAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!await isCurrentUserAdmin()) redirect("/admin/login");
  let batches: AdminBatch[] = [];
  let suppliers: AdminSupplier[] = [];
  let loadError = "";
  try {
    [batches, suppliers] = await Promise.all([listAdminBatches(), listSuppliers()]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Data admin tidak dapat dimuat.";
  }
  return <AdminDashboard batches={batches} suppliers={suppliers} loadError={loadError} />;
}
