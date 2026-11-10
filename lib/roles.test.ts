import { describe, expect, it } from "vitest";
import { dashboardRedirect, landingPath, userFromClaims, type CurrentUser } from "./roles";

const user = (role: CurrentUser["role"]): CurrentUser => ({ id: "u1", role, demo: false, email: null });

describe("userFromClaims", () => {
  it("membaca id, peran, demo, dan email dari klaim", () => {
    expect(userFromClaims({ sub: "u1", email: "a@b.c", app_metadata: { role: "grosir", demo: true } }))
      .toEqual({ id: "u1", role: "grosir", demo: true, email: "a@b.c" });
  });

  it("demo hanya true bila bernilai boolean true", () => {
    expect(userFromClaims({ sub: "u1", app_metadata: { role: "pembeli", demo: "true" } })?.demo).toBe(false);
  });

  it("peran tidak dikenal atau tanpa sub → null", () => {
    expect(userFromClaims({ sub: "u1", app_metadata: { role: "superuser" } })).toBeNull();
    expect(userFromClaims({ sub: "u1", app_metadata: {} })).toBeNull();
    expect(userFromClaims({ app_metadata: { role: "admin" } })).toBeNull();
    expect(userFromClaims(null)).toBeNull();
  });
});

describe("dashboardRedirect", () => {
  it("halaman umum tidak dialihkan", () => {
    expect(dashboardRedirect("/", "", null)).toBeNull();
    expect(dashboardRedirect("/administrasi", "", null)).toBeNull();
    expect(dashboardRedirect("/masuk", "", user("admin"))).toBeNull();
  });

  it("tanpa sesi → /masuk dengan peran dan path lanjutan", () => {
    expect(dashboardRedirect("/grosir/batch", "?status=open", null)).toBe("/masuk?peran=grosir&lanjut=%2Fgrosir%2Fbatch%3Fstatus%3Dopen");
    expect(dashboardRedirect("/admin", "", null)).toBe("/masuk?peran=admin&lanjut=%2Fadmin");
  });

  it("peran sesuai → lanjut", () => {
    expect(dashboardRedirect("/akun", "", user("pembeli"))).toBeNull();
    expect(dashboardRedirect("/admin/aktivitas-ai", "", user("admin"))).toBeNull();
  });

  it("peran salah → dashboard miliknya", () => {
    expect(dashboardRedirect("/admin", "", user("pembeli"))).toBe("/akun");
    expect(dashboardRedirect("/akun", "", user("grosir"))).toBe("/grosir");
    expect(dashboardRedirect("/grosir/profil", "", user("admin"))).toBe("/admin");
  });
});

describe("landingPath", () => {
  it("memakai path lanjut milik dashboard peran yang sama", () => {
    expect(landingPath("grosir", "/grosir/batch?x=1")).toBe("/grosir/batch?x=1");
  });

  it("menolak path peran lain, absolut, atau protocol-relative", () => {
    expect(landingPath("pembeli", "/admin")).toBe("/akun");
    expect(landingPath("admin", "https://jahat.test/admin")).toBe("/admin");
    expect(landingPath("admin", "//jahat.test/admin")).toBe("/admin");
    expect(landingPath("admin", null)).toBe("/admin");
  });
});
