import { describe, expect, it, vi } from "vitest";
import { createRuntimeDeps } from "./runtime";

describe("createRuntimeDeps", () => {
  it("memakai Nemotron gratis dan mode json-text bila env kosong", async () => {
    const deps = await createRuntimeDeps({});
    expect(deps.stage2?.model).toBe("nvidia/nemotron-3.5-lightning-free");
    expect(deps.agentEnabled).toBe(true);
  });

  it("membaca model tahap 2 dari AGENT_STAGE2_MODEL", async () => {
    const deps = await createRuntimeDeps({ AGENT_STAGE2_MODEL: "anthropic/claude-haiku-5.5" });
    expect(deps.stage2?.model).toBe("anthropic/claude-haiku-5.5");
  });

  it("menolak AGENT_STAGE2_OUTPUT_MODE yang tidak dikenal dengan peringatan, lalu memakai json-text", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await createRuntimeDeps({ AGENT_STAGE2_OUTPUT_MODE: "xml" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("AGENT_STAGE2_OUTPUT_MODE"));
    warn.mockRestore();
  });

  it("provider google memakai Gemini Flash Lite secara default", async () => {
    const deps = await createRuntimeDeps({ AGENT_STAGE2_PROVIDER: "google", GOOGLE_GENERATIVE_AI_API_KEY: "kunci-uji" });
    expect(deps.stage2?.model).toBe("google/gemini-3.5-flash-lite");
  });

  it("provider google membaca model dari AGENT_STAGE2_MODEL", async () => {
    const deps = await createRuntimeDeps({
      AGENT_STAGE2_PROVIDER: "google",
      AGENT_STAGE2_MODEL: "gemini-3.5-flash",
      GOOGLE_GENERATIVE_AI_API_KEY: "kunci-uji",
    });
    expect(deps.stage2?.model).toBe("google/gemini-3.5-flash");
  });

  it("provider openai-compatible memakai base URL, kunci, dan model dari env", async () => {
    const deps = await createRuntimeDeps({
      AGENT_STAGE2_PROVIDER: "openai-compatible",
      AGENT_STAGE2_BASE_URL: "https://opencode.ai/zen/v1",
      AGENT_STAGE2_API_KEY: "kunci-uji",
      AGENT_STAGE2_MODEL: "nemotron-3.5-lightning-free",
    });
    expect(deps.stage2?.model).toBe("openai-compatible/nemotron-3.5-lightning-free");
  });

  it.each([
    ["google tanpa kunci", { AGENT_STAGE2_PROVIDER: "google" }, "GOOGLE_GENERATIVE_AI_API_KEY"],
    ["openai-compatible tanpa model", { AGENT_STAGE2_PROVIDER: "openai-compatible", AGENT_STAGE2_BASE_URL: "https://x.test/v1", AGENT_STAGE2_API_KEY: "k" }, "AGENT_STAGE2_MODEL"],
    ["openai-compatible tanpa base URL", { AGENT_STAGE2_PROVIDER: "openai-compatible", AGENT_STAGE2_API_KEY: "k", AGENT_STAGE2_MODEL: "m" }, "AGENT_STAGE2_BASE_URL"],
    ["provider tak dikenal", { AGENT_STAGE2_PROVIDER: "azure" }, "AGENT_STAGE2_PROVIDER"],
  ])("%s → tahap 2 mati dengan peringatan", async (_, env, mentioned) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await createRuntimeDeps(env)).stage2).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(mentioned));
    warn.mockRestore();
  });

  it("classifier null bila artefak model belum ada", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await createRuntimeDeps({})).classifier).toBeNull();
    warn.mockRestore();
  });

  it("harga pasar dibaca dari output pipeline PIHPS", async () => {
    const price = await (await createRuntimeDeps({})).marketPrice.lookup("Bawang Merah", null);
    expect(price).toMatchObject({ material: "Bawang Merah", region: "Kota Bandung", unit: "kg", source: "PIHPS" });
  });

  it("AGENT_ENABLED=false mematikan agen dan NEXT_PUBLIC_SITE_URL dipakai untuk tautan", async () => {
    const deps = await createRuntimeDeps({ AGENT_ENABLED: "false", NEXT_PUBLIC_SITE_URL: "https://contoh.id" });
    expect(deps.agentEnabled).toBe(false);
    expect(deps.siteUrl).toBe("https://contoh.id");
  });

  it("siteUrl jatuh ke domain production Vercel", async () => {
    expect((await createRuntimeDeps({ VERCEL_PROJECT_PRODUCTION_URL: "gro-up-virid.vercel.app" })).siteUrl).toBe(
      "https://gro-up-virid.vercel.app",
    );
  });
});
