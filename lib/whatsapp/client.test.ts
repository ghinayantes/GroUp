import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendReplies } from "@/lib/whatsapp/client";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("WHATSAPP_API_VERSION", "v23.0");
  vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "token");
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123");
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const sentBody = (call: number) => JSON.parse(fetchMock.mock.calls[call][1].body);

describe("sendReplies", () => {
  it("kirim list dengan judul dipotong 24 karakter dan maksimal 10 baris", async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      id: `b${i}`,
      title: `Cabai rawit merah super premium ${i}`,
      description: "x".repeat(100),
    }));
    await sendReplies("628111", [{ kind: "list", body: "Pilih", button: "Pilih batch", rows }]);
    const payload = sentBody(0);
    const sent = payload.interactive.action.sections[0].rows;
    expect(payload.interactive.type).toBe("list");
    expect(sent.length).toBe(10);
    expect(sent[0].title.length).toBeLessThanOrEqual(24);
    expect(sent[0].description.length).toBeLessThanOrEqual(72);
  });

  it("kirim tombol berurutan setelah teks", async () => {
    await sendReplies("628111", [
      { kind: "text", body: "Halo", aiGenerated: false },
      { kind: "buttons", body: "Yakin?", buttons: [{ id: "ORDER_CONFIRM", title: "Ya, ikut" }, { id: "ORDER_CANCEL", title: "Batalkan" }] },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(0).type).toBe("text");
    expect(sentBody(0).text.body).toBe("Halo");
    expect(sentBody(1).type).toBe("interactive");
    expect(sentBody(1).interactive.type).toBe("button");
  });

  it("melempar error bila Meta membalas 500", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    await expect(sendReplies("628111", [{ kind: "text", body: "Halo", aiGenerated: false }])).rejects.toThrow();
  });
});
