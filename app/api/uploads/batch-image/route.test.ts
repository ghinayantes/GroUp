import { beforeEach, describe, expect, it, vi } from "vitest";
import { isOwnedImagePath } from "@/lib/batch-image";

const USER = "11111111-1111-4111-8111-111111111111";

const guardAdmin = vi.fn();
const currentUserId = vi.fn();
const createSignedUploadUrl = vi.fn();
const from = vi.fn(() => ({ createSignedUploadUrl }));

vi.mock("@/lib/admin-route", () => ({ guardAdmin: () => guardAdmin() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({ storage: { from } }),
  currentUserId: () => currentUserId(),
}));

const { POST } = await import("./route");

beforeEach(() => {
  guardAdmin.mockReset();
  currentUserId.mockReset();
  createSignedUploadUrl.mockReset();
  from.mockClear();
  guardAdmin.mockResolvedValue(null);
  currentUserId.mockResolvedValue(USER);
  createSignedUploadUrl.mockImplementation(async (path: string) => ({
    data: { signedUrl: "https://x/upload", token: "token-1", path },
    error: null,
  }));
});

describe("POST /api/uploads/batch-image", () => {
  it("guardAdmin mengembalikan 403 → 403 dan createSignedUploadUrl tidak dipanggil", async () => {
    const { NextResponse } = await import("next/server");
    guardAdmin.mockResolvedValue(NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 }));

    const response = await POST();

    expect(response.status).toBe(403);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("tanpa user id → 401", async () => {
    currentUserId.mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sesi tidak valid." });
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("admin → 201 dengan path milik user dan token", async () => {
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
