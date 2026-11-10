"use client";

import { useActionState, useState } from "react";
import DemoSignIn from "@/components/auth/DemoSignIn";
import { signIn } from "@/lib/auth-actions";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/roles";

const ROLE_BENEFIT: Record<Role, string> = {
  pembeli: "Pantau pesanan patungan dan lihat berapa yang kamu hemat dibanding harga pasar.",
  grosir: "Buka batch dari sinyal permintaan nyata dan dapat saran harga yang bersaing.",
  admin: "Kelola batch, verifikasi supplier, dan lihat bagaimana agen AI bekerja.",
};

export default function LoginPanel({ initialRole, next }: { initialRole: Role | null; next: string | null }) {
  const [role, setRole] = useState<Role | null>(initialRole);
  const [loginState, loginAction, loggingIn] = useActionState(signIn, null);

  return <div className="login-layout">
    <section className="login-card" aria-labelledby="login-title">
      <h2 id="login-title">Masuk sebagai</h2>
      <div className="role-cards" role="radiogroup" aria-label="Pilih peran">
        {ROLES.map((item) => <button key={item} type="button" role="radio" aria-checked={role === item} className={role === item ? "role-card active" : "role-card"} onClick={() => setRole(item)}>
          <b>{ROLE_LABEL[item]}</b>
          <small>{ROLE_BENEFIT[item]}</small>
        </button>)}
      </div>
      {role && <form action={loginAction} className="admin-form">
        <input type="hidden" name="peran" value={role} />
        {next && <input type="hidden" name="lanjut" value={next} />}
        <label>Email<input required type="email" name="email" autoComplete="email" /></label>
        <label>Kata sandi<input required type="password" name="password" autoComplete="current-password" /></label>
        {loginState?.error && <p className="form-error" role="alert">{loginState.error}</p>}
        <button className="button button-dark" disabled={loggingIn}>{loggingIn ? "Memeriksa…" : `Masuk sebagai ${ROLE_LABEL[role]}`}</button>
      </form>}
      <p className="login-note">Belum ada pendaftaran publik. Akun grosir dibuat oleh admin GroUp.</p>
    </section>
    <section className="login-card login-demo" aria-labelledby="demo-title">
      <span className="eyebrow eyebrow-dark">TANPA DAFTAR</span>
      <h2 id="demo-title">Coba sebagai juri</h2>
      <p>Masuk ke akun demo yang sudah berisi batch, pesanan, dan sinyal permintaan. Data demo direset tiap malam.</p>
      <DemoSignIn />
    </section>
  </div>;
}
