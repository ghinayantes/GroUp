export const ROLES = ["pembeli", "grosir", "admin"] as const;

export type Role = (typeof ROLES)[number];

export type CurrentUser = { id: string; role: Role; demo: boolean; email: string | null };

export const ROLE_HOME: Record<Role, string> = { pembeli: "/akun", grosir: "/grosir", admin: "/admin" };

export const ROLE_LABEL: Record<Role, string> = { pembeli: "Pembeli", grosir: "Grosir", admin: "Admin" };

export const isRole = (value: unknown): value is Role => typeof value === "string" && (ROLES as readonly string[]).includes(value);

type Claims = { sub?: unknown; email?: unknown; app_metadata?: Record<string, unknown> | null } | null | undefined;

/** Akun tanpa peran yang dikenal diperlakukan seperti tidak masuk. */
export function userFromClaims(claims: Claims): CurrentUser | null {
  const role = claims?.app_metadata?.role;
  if (!claims || typeof claims.sub !== "string" || !isRole(role)) return null;
  return {
    id: claims.sub,
    role,
    demo: claims.app_metadata?.demo === true,
    email: typeof claims.email === "string" ? claims.email : null,
  };
}

export function roleForPath(pathname: string): Role | null {
  for (const role of ROLES) {
    const home = ROLE_HOME[role];
    if (pathname === home || pathname.startsWith(`${home}/`)) return role;
  }
  return null;
}

/** Tujuan pengalihan untuk halaman dashboard; null bila boleh lanjut. */
export function dashboardRedirect(pathname: string, search: string, user: CurrentUser | null): string | null {
  const required = roleForPath(pathname);
  if (!required) return null;
  if (!user) return `/masuk?${new URLSearchParams({ peran: required, lanjut: `${pathname}${search}` })}`;
  return user.role === required ? null : ROLE_HOME[user.role];
}

/** Path `lanjut` hanya dipakai bila relatif dan berada di dashboard peran user. */
export function landingPath(role: Role, next: string | null | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") && roleForPath(next.split("?")[0]) === role) return next;
  return ROLE_HOME[role];
}
