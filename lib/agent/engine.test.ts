import { describe, expect, it, vi } from "vitest";
import { FIXTURE_BATCHES, FIXTURE_NOW } from "@/test/fixtures/batches";
import { createMemoryDeps, type MemoryDeps } from "./adapters/memory";
import { BATCH_UNAVAILABLE_TEXT, DISMISSED_TEXT, ORDER_CODE_NOT_FOUND_TEXT, ORDER_LOCKED_TEXT, menuText, notTextReply, shortCode } from "./copy";
import { createEngine } from "./engine";
import { senderHash, type IntentClassifier, type Stage2Agent } from "./ports";
import { BUTTON, type InboundMessage, type Reply } from "./types";

const SENDER = "6281234";

const throwingClassifier: IntentClassifier = {
  version: "test",
  classify: async () => {
    throw new Error("classifier tidak boleh dipanggil");
  },
  accepts: () => {
    throw new Error("classifier tidak boleh dipanggil");
  },
};

const throwingStage2: Stage2Agent = {
  model: "test",
  propose: async () => {
    throw new Error("stage2 tidak boleh dipanggil");
  },
};

const setup = () => {
  const deps = createMemoryDeps({ batches: FIXTURE_BATCHES.map((b) => ({ ...b, tiers: [...b.tiers] })), now: FIXTURE_NOW });
  deps.classifier = throwingClassifier;
  deps.stage2 = throwingStage2;
  return { deps, engine: createEngine(deps) };
};

const textMsg = (text: string, overrides: Partial<InboundMessage> = {}): InboundMessage => ({
  channel: "whatsapp", senderKey: SENDER, messageId: crypto.randomUUID(), text, kind: "text", profileName: "Sari", ...overrides,
});

const tap = (replyId: string, title = ""): InboundMessage => textMsg(title, { kind: "interactive", replyId });

const body = (replies: Reply[]) => replies.map((r) => r.body).join("\n");

const seedOrder = async (deps: MemoryDeps, quantity = 5) => {
  const { id } = await deps.orders.createOrder({
    batchId: FIXTURE_BATCHES[0].id, channel: "whatsapp", senderKey: SENDER, customerName: "Sari", quantity, messageId: crypto.randomUUID(),
  });
  return id;
};

describe("engine perintah baku", () => {
  it("MULAI mengembalikan list batch terbuka tanpa batch tutup", async () => {
    const { deps, engine } = setup();
    const { replies, trace } = await engine.handle(textMsg("mulai"));

    expect(replies).toHaveLength(1);
    expect(replies[0].kind).toBe("list");
    if (replies[0].kind !== "list") return;
    const names = replies[0].rows.map((r) => r.title);
    expect(names).toContain("Cabai Merah Keriting");
    expect(names).not.toContain("Gula Pasir");
    expect(trace.stage).toBe("fixed");
    expect(await deps.sessions.get("whatsapp", SENDER)).toMatchObject({ stage: "choose_batch" });
  });

  it("MULAI <id> langsung ke prompt jumlah", async () => {
    const { deps, engine } = setup();
    const { replies } = await engine.handle(textMsg(`START ${FIXTURE_BATCHES[1].id}`));

    expect(body(replies)).toContain("Berapa kg yang ingin kamu pesan?");
    expect(await deps.sessions.get("whatsapp", SENDER)).toMatchObject({ stage: "enter_quantity", batchId: FIXTURE_BATCHES[1].id });
  });

  it('list reply → prompt jumlah → "2,5" → tombol konfirmasi → ORDER_CONFIRM → pesanan 2.5 kg', async () => {
    const { deps, engine } = setup();
    await engine.handle(textMsg("MULAI"));

    const prompt = await engine.handle(tap(FIXTURE_BATCHES[0].id, "Cabai Merah Keriting"));
    expect(body(prompt.replies)).toContain("Berapa kg");

    const confirm = await engine.handle(textMsg("2,5"));
    expect(confirm.replies[0].kind).toBe("buttons");
    if (confirm.replies[0].kind !== "buttons") return;
    expect(confirm.replies[0].buttons.map((b) => b.id)).toContain(BUTTON.ORDER_CONFIRM);

    const done = await engine.handle(tap(BUTTON.ORDER_CONFIRM, "Ya, ikut"));
    expect(body(done.replies)).toContain("Pesananmu tercatat");
    expect(deps.state.orders).toHaveLength(1);
    expect(deps.state.orders[0]).toMatchObject({ batchId: FIXTURE_BATCHES[0].id, quantity: 2.5, customerName: "Sari" });
    expect(await deps.sessions.get("whatsapp", SENDER)).toBeNull();
  });

  it("list reply untuk batch yang sudah tutup menghapus sesi dan memberi tahu", async () => {
    const { deps, engine } = setup();
    await engine.handle(textMsg("MULAI"));
    const { replies } = await engine.handle(tap(FIXTURE_BATCHES[4].id));

    expect(body(replies)).toContain("sudah tidak tersedia");
    expect(await deps.sessions.get("whatsapp", SENDER)).toBeNull();
  });

  it("PESANAN menampilkan kode 6 karakter", async () => {
    const { deps, engine } = setup();
    const id = await seedOrder(deps);
    const { replies, trace } = await engine.handle(textMsg("pesanan"));

    expect(body(replies)).toContain(shortCode(id));
    expect(shortCode(id)).toMatch(/^[0-9A-F]{6}$/);
    expect(trace.stage).toBe("fixed");
  });

  it("UBAH <kode> 12 meminta konfirmasi lalu CHANGE_CONFIRM mengubah jumlah", async () => {
    const { deps, engine } = setup();
    const id = await seedOrder(deps);
    const ask = await engine.handle(textMsg(`ubah ${shortCode(id).toLowerCase()} 12`));

    expect(ask.replies[0].kind).toBe("buttons");
    expect(deps.state.orders[0].quantity).toBe(5);

    const done = await engine.handle(tap(BUTTON.CHANGE_CONFIRM));
    expect(body(done.replies)).toContain("diubah menjadi 12 kg");
    expect(deps.state.orders[0].quantity).toBe(12);
  });

  it("UBAH <kode> tanpa jumlah valid membalas format", async () => {
    const { deps, engine } = setup();
    const id = await seedOrder(deps);
    const { replies } = await engine.handle(textMsg(`UBAH ${shortCode(id)} banyak`));

    expect(body(replies)).toContain(`Format: UBAH ${shortCode(id)} <jumlah>`);
  });

  it("BATAL <kode> meminta konfirmasi", async () => {
    const { deps, engine } = setup();
    const id = await seedOrder(deps);
    const { replies } = await engine.handle(textMsg(`BATAL ${shortCode(id)}`));

    expect(replies[0].kind).toBe("buttons");
    if (replies[0].kind !== "buttons") return;
    expect(replies[0].buttons.map((b) => b.id)).toContain(BUTTON.CANCEL_CONFIRM);
    expect(deps.state.orders[0].status).toBe("confirmed");
  });

  it("UBAH/BATAL dengan kode yang tidak dikenal membalas kode tidak ditemukan, bukan menu", async () => {
    const { deps, engine } = setup();
    await seedOrder(deps);
    const other = await engine.handle(textMsg("BATAL ZZZZZZ"));
    const change = await engine.handle(textMsg("UBAH ZZZZZZ 3"));

    expect(body(other.replies)).toBe(ORDER_CODE_NOT_FOUND_TEXT);
    expect(body(change.replies)).toBe(ORDER_CODE_NOT_FOUND_TEXT);
  });

  it("kode milik pengirim lain dianggap tidak ditemukan", async () => {
    const { deps, engine } = setup();
    const id = await seedOrder(deps);
    const { replies } = await engine.handle(textMsg(`BATAL ${shortCode(id)}`, { senderKey: "6299" }));

    expect(body(replies)).toBe(ORDER_CODE_NOT_FOUND_TEXT);
  });

  it("UBAH untuk pesanan di batch yang sudah tutup membalas pesanan terkunci", async () => {
    const batches = FIXTURE_BATCHES.map((b) => ({ ...b, tiers: [...b.tiers] }));
    const deps = createMemoryDeps({ batches, now: FIXTURE_NOW });
    const id = await seedOrder(deps);
    batches[0].acceptingOrders = false;
    const { replies } = await createEngine(deps).handle(textMsg(`UBAH ${shortCode(id)} 3`));

    expect(body(replies)).toBe(ORDER_LOCKED_TEXT);
    expect(await deps.sessions.get("whatsapp", SENDER)).toBeNull();
  });

  it("angka saat enter_quantity untuk batch yang sudah tutup menghapus sesi dan memberi tahu", async () => {
    const batches = FIXTURE_BATCHES.map((b) => ({ ...b, tiers: [...b.tiers] }));
    const deps = createMemoryDeps({ batches, now: FIXTURE_NOW });
    const engine = createEngine(deps);
    await engine.handle(textMsg(`MULAI ${batches[0].id}`));
    batches[0].acceptingOrders = false;
    const { replies } = await engine.handle(textMsg("5"));

    expect(body(replies)).toBe(BATCH_UNAVAILABLE_TEXT);
    expect(await deps.sessions.get("whatsapp", SENDER)).toBeNull();
  });

  it("ORDER_CONFIRM tetap membalas sukses saat sessions.remove gagal, dengan tepat satu pesanan", async () => {
    const { deps, engine } = setup();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await engine.handle(textMsg(`MULAI ${FIXTURE_BATCHES[0].id}`));
    await engine.handle(textMsg("5"));
    deps.sessions.remove = async () => {
      throw new Error("db mati");
    };
    const { replies } = await engine.handle(tap(BUTTON.ORDER_CONFIRM));

    expect(body(replies)).toContain("Pesananmu tercatat");
    expect(deps.state.orders).toHaveLength(1);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("BATAL tanpa kode menghapus sesi", async () => {
    const { deps, engine } = setup();
    await engine.handle(textMsg("MULAI"));
    const { replies } = await engine.handle(textMsg("batal"));

    expect(body(replies)).toBe(DISMISSED_TEXT);
    expect(await deps.sessions.get("whatsapp", SENDER)).toBeNull();
  });

  it("sesi kedaluwarsa dihapus sebelum diproses", async () => {
    const { deps, engine } = setup();
    await deps.sessions.save({
      channel: "whatsapp", senderKey: SENDER, stage: "enter_quantity", batchId: FIXTURE_BATCHES[0].id, quantity: null,
      customerName: null, pendingAction: null, expiresAt: new Date(FIXTURE_NOW.getTime() - 1).toISOString(),
    });
    const { replies } = await engine.handle(textMsg("5"));

    expect(body(replies)).toBe(menuText());
    expect(await deps.sessions.get("whatsapp", SENDER)).toBeNull();
  });
});

describe("engine pesan non-teks (fokus review #4)", () => {
  it("pesan unsupported membalas notTextReply", async () => {
    const { deps, engine } = setup();
    const { replies, trace } = await engine.handle(textMsg("", { kind: "unsupported" }));

    expect(replies).toEqual([notTextReply()]);
    expect(trace.stage).toBe("fixed");
    expect(deps.state.traces).toHaveLength(1);
  });

  it('teks hanya emoji "👍👍" membalas notTextReply', async () => {
    const { engine } = setup();
    for (const text of ["👍👍", "   ", "👍🏽 ❤️ 🇮🇩", "👨‍👩‍👧"]) {
      const { replies, trace } = await engine.handle(textMsg(text));
      expect(replies).toEqual([notTextReply()]);
      expect(trace.stage).toBe("fixed");
    }
  });

  it("classifier/stage2 tidak dipanggil", async () => {
    const { engine } = setup();
    await expect(engine.handle(textMsg("👍👍"))).resolves.toBeDefined();
    await expect(engine.handle(textMsg("", { kind: "unsupported" }))).resolves.toBeDefined();
    await expect(engine.handle(textMsg("halo kak, ada cabai?"))).resolves.toBeDefined();
  });
});

describe("engine fallback dan pencatatan", () => {
  it("teks bebas tanpa router membalas menu dengan trace fallback", async () => {
    const { deps } = setup();
    deps.classifier = null;
    deps.stage2 = null;
    const engine = createEngine(deps);
    const { replies, trace } = await engine.handle(textMsg("mau pesan cabai 5 kg dong"));

    expect(body(replies)).toBe(menuText());
    expect(trace).toMatchObject({ stage: "fallback", action: "menu", model: null });
  });

  it("setiap handle menulis satu trace dan entri history user+assistant", async () => {
    const { deps, engine } = setup();
    const msg = textMsg("MULAI");
    await engine.handle(msg);
    await engine.handle(textMsg("halo"));

    expect(deps.state.traces).toHaveLength(2);
    expect(deps.state.traces[0]).toMatchObject({ channel: "whatsapp", senderHash: senderHash("whatsapp", SENDER) });
    expect(deps.state.traces[0].trace.latencyMs).toBeGreaterThanOrEqual(0);
    const history = await deps.history.recent("whatsapp", SENDER, 10);
    expect(history.map((h) => h.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(history[0]).toMatchObject({ content: "MULAI", aiGenerated: false });
    expect(history[3]).toMatchObject({ content: menuText(), aiGenerated: false });
  });

  it("error dari dependensi membalas pesan gagal yang ramah dan tetap mencatat trace", async () => {
    const { deps, engine } = setup();
    deps.orders.listOpenBatches = async () => {
      throw new Error("db mati");
    };
    const { replies } = await engine.handle(textMsg("MULAI"));

    expect(body(replies)).toContain("belum bisa diproses");
    expect(deps.state.traces).toHaveLength(1);
  });
});

describe("label AI (Tugas 16)", () => {
  const answering: Stage2Agent = {
    model: "test/answer",
    propose: async () => ({ action: { type: "answer", text: "Pembayaran lewat transfer setelah kuota tercapai." }, model: "test/answer", inputTokens: 1, outputTokens: 1, toolNames: [], toolOutputs: [] }),
  };
  const aiSetup = () => {
    const { deps } = setup();
    deps.classifier = null;
    deps.stage2 = answering;
    return { deps, engine: createEngine(deps) };
  };
  const NOTE = "Balasan ini dibantu AI dan bisa keliru. Cara kerjanya: http://localhost:3000/transparansi-ai";

  it("balasan AI diberi awalan 🤖 dan catatan transparansi pada balasan AI pertama", async () => {
    const { engine } = aiSetup();
    const { replies } = await engine.handle(textMsg("kapan bayarnya kak"));
    expect(replies).toHaveLength(1);
    expect(replies[0].body.startsWith("🤖 Pembayaran lewat transfer")).toBe(true);
    expect(replies[0].body).toContain(NOTE);
  });

  it("balasan AI kedua dalam 24 jam tidak mengulang catatan, setelah 24 jam catatan muncul lagi", async () => {
    const { deps, engine } = aiSetup();
    await engine.handle(textMsg("kapan bayarnya kak"));
    const second = await engine.handle(textMsg("kalau transfer ke mana"));
    expect(second.replies[0].body.startsWith("🤖 ")).toBe(true);
    expect(second.replies[0].body).not.toContain(NOTE);

    deps.now = () => new Date(FIXTURE_NOW.getTime() + 25 * 3_600_000);
    const later = await engine.handle(textMsg("kapan bayarnya kak"));
    expect(later.replies[0].body).toContain(NOTE);
  });

  it("balasan non-AI tidak diberi awalan 🤖", async () => {
    const { engine } = aiSetup();
    const { replies } = await engine.handle(textMsg("MULAI"));
    expect(replies.every((r) => !r.body.startsWith("🤖"))).toBe(true);
  });

  it("riwayat menyimpan balasan berlabel sebagai aiGenerated", async () => {
    const { deps, engine } = aiSetup();
    await engine.handle(textMsg("kapan bayarnya kak"));
    const history = await deps.history.recent("whatsapp", SENDER, 10);
    expect(history.at(-1)).toMatchObject({ role: "assistant", aiGenerated: true });
    expect(history.at(-1)?.content.startsWith("🤖 ")).toBe(true);
  });
});
