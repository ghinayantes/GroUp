import Link from "next/link";

export function BrandLogo({ className = "brand-logo" }: { className?: string }) {
  return <svg className={className} viewBox="8 2 162 104" aria-hidden="true">
    <g fill="none" strokeWidth="11.5" strokeLinejoin="round">
      <path stroke="#2e6853" strokeLinecap="round" d="M15 45.8H161L155.5 63H20.5L29 98H144.5L150 81H49" />
      <path stroke="#e9692c" d="M50.5 13.5 61.3 24.3M127.5 13.5 116.7 24.3" />
      <path stroke="#87be3c" strokeLinecap="round" d="M53.5 43 82 14M124.5 43 96 14" />
    </g>
    <g fill="#e9692c">
      <circle cx="50.5" cy="13.5" r="5.75" />
      <circle cx="127.5" cy="13.5" r="5.75" />
      <circle cx="67" cy="10" r="5.8" />
      <circle cx="111" cy="10" r="5.8" />
    </g>
  </svg>;
}

export function Brand({ className = "brand" }: { className?: string }) {
  return <Link className={className} href="/" aria-label="GroUp — beranda">
    <BrandLogo />
    <span>Gro<span className="brand-accent">Up</span></span>
  </Link>;
}
