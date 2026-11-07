import Link from "next/link";

export type Crumb = { href?: string; label: string };

/** Judul halaman dengan breadcrumb, gaya situs grocery besar. */
export default function PageHero({ crumbs, title, description, image, tone = "cream", children }: {
  crumbs: Crumb[]; title: React.ReactNode; description?: string; image?: string; tone?: "cream" | "green"; children?: React.ReactNode;
}) {
  return <section className={`page-hero page-hero-${tone}`}>
    <div className="page-hero-inner">
      <div>
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Beranda</Link>
          {crumbs.map((crumb) => <span key={crumb.label}>{crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}</span>)}
        </nav>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {children}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- foto dekoratif */}
      {image && <img src={image} alt="" />}
    </div>
  </section>;
}
