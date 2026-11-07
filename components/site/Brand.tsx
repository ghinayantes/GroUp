import Link from "next/link";

export function Brand({ className = "brand" }: { className?: string }) {
  return <Link className={className} href="/" aria-label="GroUp — beranda">
    <span>Gro<span className="brand-accent">Up</span></span>
  </Link>;
}
