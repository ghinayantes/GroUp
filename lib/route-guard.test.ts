import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/roles";

const currentUser = vi.fn<() => Promise<CurrentUser | null>>();
const hasSupabaseSecret = vi.fn(() => true);

vi.mock("@/lib/auth", () => ({ currentUser: () => currentUser() }));
vi.mock("@/lib/supabase/server", () => ({ hasSupabaseSecret: () => hasSupabaseSecret() }));

const { guardRole } = await import("./route-guard");

const grosir: CurrentUser = { id: "g1", role: "grosir", demo: false, email: null };

beforeEach(() => {
  currentUser.mockReset();
  hasSupabaseSecret.mockReturnValue(true);
});

describe("guardRole", () => {
  it("tanpa konfigurasi Supabase → 503", async () => {
    hasSupabaseSecret.mockReturnValue(false);
    const { denied } = await guardRole("admin");
    expect(denied?.status).toBe(503);
  });

  it("anonim → 403", async () => {
    currentUser.mockResolvedValue(null);
    const { user, denied } = await guardRole("admin", "grosir");
    expect(user).toBeNull();
    expect(denied?.status).toBe(403);
  });

  it("peran tidak termasuk → 403", async () => {
    currentUser.mockResolvedValue({ ...grosir, role: "pembeli" });
    expect((await guardRole("admin", "grosir")).denied?.status).toBe(403);
  });

  it("peran termasuk → user dikembalikan", async () => {
    currentUser.mockResolvedValue(grosir);
    expect(await guardRole("admin", "grosir")).toEqual({ user: grosir, denied: null });
  });
});
