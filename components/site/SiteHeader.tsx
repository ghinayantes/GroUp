"use client";

import Form from "next/form";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Brand } from "@/components/site/Brand";
import Icon from "@/components/site/Icon";
import type { CategorySummary } from "@/lib/batch";

const links = [
  { href: "/", label: "Beranda" },
  { href: "/patungan", label: "Patungan" },
  { href: "/kategori", label: "Kategori" },
  { href: "/pesanan", label: "Kelola pesanan" },
];

export default function SiteHeader({ categories }: { categories: CategorySummary[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>(".nav-active");
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
  }, [pathname]);

  return <header className="site-header">
    <div className="header-top">
      <Brand />
      <Form action="/patungan" className="search-bar" role="search">
        <label className="search-category">
          <span className="sr-only">Kategori</span>
          <select name="kategori" defaultValue="">
            <option value="">Semua kategori</option>
            {categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </select>
          <Icon name="chevron" size={14} />
        </label>
        <input name="q" placeholder="Cari bahan baku atau supplier…" aria-label="Cari bahan baku atau supplier" />
        <button aria-label="Cari"><Icon name="search" size={19} /></button>
      </Form>
      <nav className="header-icons" aria-label="Akun">
        <Link href="/pesanan" aria-label="Kelola pesanan" title="Kelola pesanan"><Icon name="bag" /></Link>
        <Link href="/admin" aria-label="Area pengelola" title="Area pengelola"><Icon name="user" /></Link>
      </nav>
    </div>
    <nav ref={navRef} className="main-nav" aria-label="Navigasi utama">
      {links.map((link) => <Link key={link.href} href={link.href} className={isActive(link.href) ? "nav-active" : undefined} aria-current={isActive(link.href) ? "page" : undefined}>{link.label}</Link>)}
    </nav>
  </header>;
}
