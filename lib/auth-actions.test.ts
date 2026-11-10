import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPassword = vi.fn();
const signOut = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));
vi.mock("@/lib/supabase/server", () => ({
  hasSupabaseConfig: () => true,
  createSupabaseServerClient: async () => ({ auth: { signInWithPassword, signOut } }),
}));

const { signIn, signInAsDemo } = await import("./auth-actions");

const account = (role: string | undefined) => ({ data: { user: { id: "u1", email: "x@test", app_metadata: role ? { role } : {} } }, error: null });

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

beforeEach(() => {
  signInWithPassword.mockReset();
  signOut.mockReset();
  redirect.mockClear();
  vi.stubEnv("DEMO_GROSIR_EMAIL", "grosir.demo@test");
  vi.stubEnv("DEMO_GROSIR_PASSWORD", "rahasia");
  vi.stubEnv("DEMO_ADMIN_EMAIL", "");
  vi.stubEnv("DEMO_ADMIN_PASSWORD", "");
});

afterEach(() => vi.unstubAllEnvs());

describe("signInAsDemo", () => {
  it("peran tidak dikenal ditolak tanpa login", async () => {
    expect(await signInAsDemo("superuser")).toEqual({ error: "Peran demo tidak dikenal." });
    expect(await signInAsDemo(null)).toEqual({ error: "Peran demo tidak dikenal." });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("env kosong → pesan jelas tanpa login", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await signInAsDemo("admin");
    expect(result).toEqual({ error: "Akun demo Admin belum disiapkan. Coba peran lain atau hubungi tim GroUp." });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("login dengan kredensial env lalu ke dashboard peran", async () => {
    signInWithPassword.mockResolvedValue(account("grosir"));
    await expect(signInAsDemo("grosir")).rejects.toThrow("NEXT_REDIRECT:/grosir");
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "grosir.demo@test", password: "rahasia" });
  });

  it("kredensial salah → pesan error", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: "Invalid login credentials" } });
    expect(await signInAsDemo("grosir")).toEqual({ error: "Email atau kata sandi salah." });
  });
});

describe("signIn", () => {
  it("peran akun berbeda dari kartu → dashboard miliknya dengan pemberitahuan", async () => {
    signInWithPassword.mockResolvedValue(account("pembeli"));
    await expect(signIn(null, form({ email: "a@test", password: "x", peran: "admin" }))).rejects.toThrow("NEXT_REDIRECT:/akun?info=peran-berbeda");
  });

  it("memakai path lanjut milik peran yang sama", async () => {
    signInWithPassword.mockResolvedValue(account("admin"));
    await expect(signIn(null, form({ email: "a@test", password: "x", peran: "admin", lanjut: "/admin/aktivitas-ai" }))).rejects.toThrow("NEXT_REDIRECT:/admin/aktivitas-ai");
  });

  it("akun tanpa peran dikeluarkan lagi", async () => {
    signInWithPassword.mockResolvedValue(account(undefined));
    expect(await signIn(null, form({ email: "a@test", password: "x" }))).toEqual({ error: "Akun ini belum punya peran. Hubungi admin GroUp." });
    expect(signOut).toHaveBeenCalled();
  });

  it("form kosong ditolak", async () => {
    expect(await signIn(null, form({ email: "", password: "" }))).toEqual({ error: "Isi email dan kata sandi." });
  });
});
