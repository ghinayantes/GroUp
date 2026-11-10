import { beforeEach, describe, expect, it, vi } from "vitest";
import { isOwnedImagePath } from "@/lib/batch-image";
import type { CurrentUser } from "@/lib/roles";

const USER = "11111111-1111-4111-8111-111111111111";

const currentUser = vi.fn<() => Promise<CurrentUser | null>>();
const createSignedUploadUrl = vi.fn();
const from = vi.fn(() => ({ createSignedUploadUrl }));

vi.mock("@/lib/auth", () => ({ currentUser: () => currentUser() }));
vi.mock("@/lib/supabase/server", () => ({
  hasSupabaseSecret: () => true,
  createSupabaseAdminClient: () => ({ storage: { from } }),
}));

const { POST } = await import("./route");

const as = (role: CurrentUser["role"]): CurrentUser => ({ id: USER, role, demo: false, email: null });

beforeEach(() => {
  currentUser.mockReset();
  createSignedUploadUrl.mockReset();
  from.mockClear();
  currentUser.mockResolvedValue(as("admin"));
  createSignedUploadUrl.mockImplementation(async (path: string) => ({
    data: { signedUrl: "https://x/upload", token: "token-1", path },
    error: null,
  }));
});

describe("POST /api/uploads/batch-image", () => {
  it.each([["anonim", null], ["pembeli", as("pembeli")]])("%s → 403 dan createSignedUploadUrl tidak dipanggil", async (_label, user) => {
    currentUser.mockResolvedValue(user);

    const response = await POST();

    expect(response.status).toBe(403);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it.each(["admin", "grosir"] as const)("%s → 201 dengan path milik user dan token", async (role) => {
    currentUser.mockResolvedValue(as(role));

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(from).toHaveBeenCalledWith("batch-images");
    expect(body.path).toMatch(new RegExp(`^${USER}/[0-9a-f-]{36}\\.webp$`));
    expect(isOwnedImagePath(body.path, USER)).toBe(true);
    expect(body).toEqual({ path: body.path, token: "token-1" });
    expect(createSignedUploadUrl).toHaveBeenCalledWith(body.path);
  });

  it("storage error → 502", async () => {
    createSignedUploadUrl.mockResolvedValue({ data: null, error: { message: "boom" } });

    const response = await POST();

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Tautan upload belum dapat dibuat." });
  });
});
