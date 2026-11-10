import { DashHeader } from "@/components/dashboard/Shell";
import SupplierTrustCard from "@/components/trust/SupplierTrustCard";
import { requireRole } from "@/lib/auth";
import { supplierForOwner } from "@/lib/dashboard-data";
import { loadSupplierTrust } from "@/lib/trust/supplier-trust";

export default async function GrosirProfile() {
  const user = await requireRole("grosir");
  const supplier = await supplierForOwner(user.id);
  const trust = supplier ? await loadSupplierTrust(supplier.id) : null;
  return <>
    <DashHeader eyebrow="PROFIL" title={supplier?.name ?? "Profil supplier"}>Pratinjau kartu kepercayaan yang dilihat pembeli di halaman batch kamu.</DashHeader>
    <section className="dash-card">
      {!supplier ? <p className="admin-message">Akun ini belum dihubungkan ke supplier.</p>
        : trust ? <SupplierTrustCard trust={trust} />
        : <p className="admin-message">Kartu kepercayaan belum dapat dimuat.</p>}
    </section>
  </>;
}
