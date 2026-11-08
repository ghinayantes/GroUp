import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createSupabaseAdminClient: () => ({ rpc }) }));

const { GET } = await import("./route");

const call = (authorization?: string) =>
  GET(new NextRequest("http://localhost/api/cron/cleanup", { headers: authorization ? { authorization } : {} }));

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: null, error: null });
  vi.stubEnv("CRON_SECRET", "rahasia-cron-uji-123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/cron/cleanup", () => {
  it("tanpa header 401", async () => {
    const response = await call();

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("header salah 401", async () => {
    const response = await call("Bearer salah");

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("CRON_SECRET kosong selalu 401", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const response = await call("Bearer ");

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("header benar memanggil rpc cleanup_agent_data", async () => {
    const response = await call("Bearer rahasia-cron-uji-123");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("cleanup_agent_data");
  });

  it("kegagalan database dibalas 500", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const response = await call("Bearer rahasia-cron-uji-123");

    expect(response.status).toBe(500);
  });
});
