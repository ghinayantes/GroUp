"use client";

import { useState } from "react";
import { Brand } from "@/components/site/Brand";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      router.push("/admin");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Login gagal."); }
    finally { setLoading(false); }
  }

  return <main className="admin-shell"><Brand /><section className="admin-panel"><div className="eyebrow eyebrow-dark">AREA PENGELOLA</div><h1>Masuk admin</h1><p>Gunakan akun admin GroUp.</p><form onSubmit={signIn} className="admin-form"><label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Kata sandi<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>{error && <p className="form-error">{error}</p>}<button className="button button-dark" disabled={loading}>{loading ? "Memeriksa…" : "Masuk"}</button></form></section></main>;
}
