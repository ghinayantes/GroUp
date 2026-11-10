import { describe, expect, it, vi } from "vitest";
import { selectStage2Model, stage2ThinkingLevel } from "./model-provider";

const google = { AGENT_STAGE2_PROVIDER: "google", GOOGLE_GENERATIVE_AI_API_KEY: "key" };

describe("stage2ThinkingLevel", () => {
  it("memakai minimal bila kosong", () => {
    expect(stage2ThinkingLevel({})).toBe("minimal");
  });

  it("memakai nilai env yang dikenal", () => {
    expect(stage2ThinkingLevel({ AGENT_STAGE2_THINKING_LEVEL: "low" })).toBe("low");
  });

  it("kembali ke minimal dengan peringatan bila nilai tidak dikenal", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(stage2ThinkingLevel({ AGENT_STAGE2_THINKING_LEVEL: "turbo" })).toBe("minimal");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("selectStage2Model", () => {
  it("mengirim thinking level ke Gemini", () => {
    expect(selectStage2Model(google)?.providerOptions).toEqual({ google: { thinkingConfig: { thinkingLevel: "minimal" } } });
    expect(selectStage2Model({ ...google, AGENT_STAGE2_THINKING_LEVEL: "high" })?.providerOptions).toEqual({
      google: { thinkingConfig: { thinkingLevel: "high" } },
    });
  });

  it("tidak mengirim opsi Google ke penyedia lain", () => {
    expect(selectStage2Model({ AGENT_STAGE2_PROVIDER: "gateway" })?.providerOptions).toBeUndefined();
  });
});
