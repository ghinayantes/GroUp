import Link from "next/link";
import { Suspense } from "react";
import { Brand } from "@/components/site/Brand";
import { DashboardNav, RoleNotice, type NavItem } from "@/components/dashboard/DashboardNav";
import { signOut } from "@/lib/auth-actions";
import { ROLE_LABEL, type CurrentUser, type Role } from "@/lib/roles";

const NAV: Record<Role, NavItem[]> = {
  pembeli: [
    { href: "/akun", label: "Ringkasan", icon: "home" },
    { href: "/akun/pesanan", label: "Pesanan saya", icon: "bag" },
  ],
  grosir: [
    { href: "/grosir", label: "Ringkasan", icon: "home" },
    { href: "/grosir/batch", label: "Batch saya", icon: "store" },
    { href: "/grosir/buka-batch", label: "Buka batch", icon: "truck" },
    { href: "/grosir/radar", label: "Radar", icon: "chart" },
    { href: "/grosir/profil", label: "Profil", icon: "shield" },
  ],
  admin: [
    { href: "/admin", label: "Ringkasan", icon: "home" },
    { href: "/admin/batch", label: "Batch & pesanan", icon: "store" },
    { href: "/admin/supplier", label: "Supplier", icon: "shield" },
    { href: "/admin/aktivitas-ai", label: "Aktivitas AI", icon: "chart" },
  ],
};

export default function Shell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  return <div className="dash">
    <aside className="dash-side">
      <Brand />
      <DashboardNav items={NAV[user.role]} />
      <Link href="/" className="dash-site-link">← Kembali ke situs</Link>
    </aside>
    <div className="dash-body">
      <header className="dash-top">
        <span className={`pill dash-role dash-role-${user.role}`}>{ROLE_LABEL[user.role]}</span>
        <span className="dash-name">{user.email ?? "Akun GroUp"}</span>
        <form action={signOut}><button className="button button-outline dash-logout">Keluar</button></form>
      </header>
      {user.demo && <p className="dash-demo" role="note">Mode demo, data direset tiap malam.</p>}
      <Suspense fallback={null}><RoleNotice /></Suspense>
      <main className="dash-main">{children}</main>
    </div>
  </div>;
}

export function DashHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return <header className="dash-head">
    <span className="eyebrow eyebrow-dark">{eyebrow}</span>
    <h1>{title}</h1>
    {children && <div className="dash-head-copy">{children}</div>}
  </header>;
}

export function StatTile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return <div className="stat-tile"><small>{label}</small><b>{value}</b>{hint && <span>{hint}</span>}</div>;
}
