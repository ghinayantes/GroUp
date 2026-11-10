"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import Icon, { type IconName } from "@/components/site/Icon";

export type NavItem = { href: string; label: string; icon: IconName };

export function DashboardNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const home = items[0]?.href;
  const active = (href: string) => (href === home ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  return <nav className="dash-nav" aria-label="Menu dashboard">
    {items.map((item) => <Link key={item.href} href={item.href} className={active(item.href) ? "active" : undefined} aria-current={active(item.href) ? "page" : undefined}>
      <Icon name={item.icon} size={18} /><span>{item.label}</span>
    </Link>)}
  </nav>;
}

export function RoleNotice() {
  const info = useSearchParams().get("info");
  if (info !== "peran-berbeda") return null;
  return <p className="dash-notice" role="status">Akun ini terdaftar dengan peran lain, jadi kamu diarahkan ke dashboard milik akun ini.</p>;
}
