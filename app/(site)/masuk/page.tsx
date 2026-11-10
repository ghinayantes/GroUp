import type { Metadata } from "next";
import Link from "next/link";
import LoginPanel from "@/components/auth/LoginPanel";
import PageHero from "@/components/site/PageHero";
import { currentUser } from "@/lib/auth";
import { isRole, ROLE_HOME, ROLE_LABEL } from "@/lib/roles";

export const metadata: Metadata = { title: "Masuk — GroUp" };

type Props = { searchParams: Promise<{ peran?: string; lanjut?: string }> };

export default async function MasukPage({ searchParams }: Props) {
  const { peran, lanjut } = await searchParams;
  const user = await currentUser();
  return <main>
    <PageHero crumbs={[{ label: "Masuk" }]} title={<>Masuk ke <em>dashboard</em></>} description="Pilih peranmu. Juri bisa langsung mencoba akun demo tanpa mendaftar." />
    <section className="section">
      {user && <p className="login-current" role="status">Kamu sedang masuk sebagai {ROLE_LABEL[user.role]}. <Link href={ROLE_HOME[user.role]} className="text-link">Buka dashboard</Link></p>}
      <LoginPanel initialRole={isRole(peran) ? peran : null} next={typeof lanjut === "string" ? lanjut : null} />
    </section>
  </main>;
}
