"use client";

import { useActionState } from "react";
import { signInAsDemoForm } from "@/lib/auth-actions";
import { ROLE_LABEL, ROLES } from "@/lib/roles";

/** Tombol login akun demo; kredensial dibaca server action dari env, tidak pernah ke browser. */
export default function DemoSignIn({ className = "demo-buttons", buttonClass = "button button-outline" }: { className?: string; buttonClass?: string }) {
  const [state, action, pending] = useActionState(signInAsDemoForm, null);
  return <>
    <form action={action} className={className}>
      {ROLES.map((role) => <button key={role} name="role" value={role} className={buttonClass} disabled={pending}>Coba sebagai {ROLE_LABEL[role]}</button>)}
    </form>
    {state?.error && <p className="form-error" role="alert">{state.error}</p>}
  </>;
}
