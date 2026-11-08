import { describe, expect, it } from "vitest";
import { FIXTURE_BATCHES, FIXTURE_NOW } from "@/test/fixtures/batches";
import { createMemoryDeps, type MemoryDeps } from "./adapters/memory";
import { executeConfirmation, presentAction, type ActionContext } from "./actions";
import { menuText, shortCode } from "./copy";
import { BUTTON, type InboundMessage, type Reply } from "./types";

const SENDER = "6281234";

const setup = () => {
  const batches = FIXTURE_BATCHES.map((b) => ({ ...b, tiers: [...b.tiers] }));
  return { deps: createMemoryDeps({ batches, now: FIXTURE_NOW }), batches };
};

const message = (overrides: Partial<InboundMessage> = {}): InboundMessage => ({
  channel: "whatsapp", senderKey: SENDER, messageId: crypto.randomUUID(), text: "", kind: "text", profileName: "Sari", ...overrides,
});

const contextFor = async (deps: MemoryDeps, msg = message()): Promise<ActionContext> => ({
  deps,
  msg,
  batches: await deps.orders.listOpenBatches(),
  orders: await deps.orders.listOrders(msg.channel, msg.senderKey),
});

const session = (deps: MemoryDeps) => deps.sessions.get("whatsapp", SENDER);

const press = async (deps: MemoryDeps, buttonId: string) => {
  const msg = message({ kind: "interactive", replyId: buttonId });
  return executeConfirmation(buttonId, await session(deps), await contextFor(deps, msg));
};

const texts = (replies: Reply[]) => replies.map((r) => r.body).join("\n");

const seedOrder = async (deps: MemoryDeps, senderKey = SENDER, quantity = 5) => {
  const { id } = await deps.orders.createOrder({
    batchId: FIXTURE_BATCHES[0].id, channel: "whatsapp", senderKey, customerName: "Sari", quantity, messageId: crypto.randomUUID(),
  });
  deps.writes.length = 0;
  return id;
};

describe("presentAction", () => {
  it("confirm_join valid menghasilkan tombol ORDER_CONFIRM dan sesi confirm_order", async () => {
    const { deps, batches } = setup();
    const replies = await presentAction({ type: "confirm_join", batchId: batches[0].id, quantity: 5 }, await contextFor(deps));

    expect(replies).toHaveLength(1);
    expect(replies[0].kind).toBe("buttons");
    if (replies[0].kind !== "buttons") return;
    expect(replies[0].buttons.map((b) => b.id)).toEqual([BUTTON.ORDER_CONFIRM, BUTTON.DISMISS]);
    expect(replies[0].body).toContain("Cabai Merah Keriting");
    expect(await session(deps)).toMatchObject({ stage: "confirm_order", batchId: batches[0].id, quantity: 5, customerName: "Sari" });
    expect(deps.writes).toEqual([]);
  });

  it("confirm_join untuk batch tutup turun ke menu", async () => {
    const { deps, batches } = setup();
    const gula = batches.find((b) => b.name === "Gula Pasir")!;
    const replies = await presentAction({ type: "confirm_join", batchId: gula.id, quantity: 5 }, await contextFor(deps));

    expect(replies).toEqual([{ kind: "text", body: menuText(), aiGenerated: false }]);
    expect(await session(deps)).toBeNull();
  });

  it("confirm_join jumlah 0 turun ke ask_quantity", async () => {
    const { deps, batches } = setup();
    const replies = await presentAction({ type: "confirm_join", batchId: batches[0].id, quantity: 0 }, await contextFor(deps));

    expect(replies[0].kind).toBe("text");
    expect(replies[0].body).toContain("Berapa kg yang ingin kamu pesan?");
    expect(await session(deps)).toMatchObject({ stage: "enter_quantity", batchId: batches[0].id, quantity: null });
  });

  it("ask_quantity menyimpan sesi enter_quantity", async () => {
    const { deps, batches } = setup();
    await presentAction({ type: "ask_quantity", batchId: batches[1].id }, await contextFor(deps));
    expect(await session(deps)).toMatchObject({ stage: "enter_quantity", batchId: batches[1].id });
  });

  it("choose_batch hanya menampilkan kandidat yang masih terbuka", async () => {
    const { deps, batches } = setup();
    const gula = batches.find((b) => b.name === "Gula Pasir")!;
    const replies = await presentAction({ type: "choose_batch", candidateBatchIds: [batches[0].id, gula.id] }, await contextFor(deps));

    expect(replies[0].kind).toBe("list");
    if (replies[0].kind !== "list") return;
    expect(replies[0].rows.map((r) => r.id)).toEqual([batches[0].id]);
    expect(await session(deps)).toMatchObject({ stage: "choose_batch" });
  });

  it("choose_batch tanpa kandidat terbuka menampilkan semua batch terbuka", async () => {
    const { deps, batches } = setup();
    const gula = batches.find((b) => b.name === "Gula Pasir")!;
    const replies = await presentAction({ type: "choose_batch", candidateBatchIds: [gula.id] }, await contextFor(deps));

    if (replies[0].kind !== "list") throw new Error("expected list");
    expect(replies[0].rows).toHaveLength(4);
  });

  it("confirm_change dengan kode milik orang lain turun ke menu dan tidak ada writes", async () => {
    const { deps } = setup();
    const othersOrder = await seedOrder(deps, "6299999");
    const replies = await presentAction({ type: "confirm_change", orderCode: shortCode(othersOrder), quantity: 12 }, await contextFor(deps));

    expect(replies).toEqual([{ kind: "text", body: menuText(), aiGenerated: false }]);
    expect(await session(deps)).toBeNull();
    expect(deps.writes).toEqual([]);
  });

  it("confirm_change valid menyimpan pendingAction dan menampilkan tombol CHANGE_CONFIRM", async () => {
    const { deps } = setup();
    const id = await seedOrder(deps);
    const replies = await presentAction({ type: "confirm_change", orderCode: shortCode(id).toLowerCase(), quantity: 12 }, await contextFor(deps));

    if (replies[0].kind !== "buttons") throw new Error("expected buttons");
    expect(replies[0].buttons).toEqual([
      { id: BUTTON.CHANGE_CONFIRM, title: "Ya, ubah" },
      { id: BUTTON.DISMISS, title: "Batalkan" },
    ]);
    expect(await session(deps)).toMatchObject({
      stage: "confirm_change",
      pendingAction: { type: "confirm_change", orderCode: shortCode(id), quantity: 12 },
    });
  });

  it("confirm_cancel menampilkan tombol CANCEL_CONFIRM", async () => {
    const { deps } = setup();
    const id = await seedOrder(deps);
    const replies = await presentAction({ type: "confirm_cancel", orderCode: shortCode(id) }, await contextFor(deps));

    if (replies[0].kind !== "buttons") throw new Error("expected buttons");
    expect(replies[0].buttons).toEqual([
      { id: BUTTON.CANCEL_CONFIRM, title: "Ya, batalkan" },
      { id: BUTTON.DISMISS, title: "Tidak jadi" },
    ]);
    expect(await session(deps)).toMatchObject({ stage: "confirm_cancel" });
  });

  it("confirm_interest dengan bahan 1 karakter turun ke menu", async () => {
    const { deps } = setup();
    const replies = await presentAction({ type: "confirm_interest", material: " x ", quantity: null, unit: null, frequency: null }, await contextFor(deps));
    expect(replies).toEqual([{ kind: "text", body: menuText(), aiGenerated: false }]);
  });

  it("list_orders tanpa pesanan membalas belum ada pesanan aktif", async () => {
    const { deps } = setup();
    const replies = await presentAction({ type: "list_orders" }, await contextFor(deps));
    expect(texts(replies)).toContain("Belum ada pesanan aktif");
  });

  it("list_orders menampilkan kode 6 karakter", async () => {
    const { deps } = setup();
    const id = await seedOrder(deps);
    const replies = await presentAction({ type: "list_orders" }, await contextFor(deps));
    expect(texts(replies)).toContain(`${shortCode(id)} · Cabai Merah Keriting · 5 kg`);
  });

  it("answer menghasilkan Reply text aiGenerated true", async () => {
    const { deps } = setup();
    const replies = await presentAction({ type: "answer", text: "Harga cabai sekarang Rp42.000/kg." }, await contextFor(deps));
    expect(replies).toEqual([{ kind: "text", body: "Harga cabai sekarang Rp42.000/kg.", aiGenerated: true }]);
  });

  it("menu menghasilkan menuText", async () => {
    const { deps } = setup();
    expect(await presentAction({ type: "menu" }, await contextFor(deps))).toEqual([{ kind: "text", body: menuText(), aiGenerated: false }]);
  });
});

describe("executeConfirmation", () => {
  it("ORDER_CONFIRM dengan sesi confirm_order membuat tepat satu pesanan", async () => {
    const { deps, batches } = setup();
    await presentAction({ type: "confirm_join", batchId: batches[0].id, quantity: 2.5 }, await contextFor(deps));
    const replies = await press(deps, BUTTON.ORDER_CONFIRM);

    expect(deps.writes.map((w) => w.kind)).toEqual(["create"]);
    expect(deps.state.orders).toHaveLength(1);
    expect(deps.state.orders[0]).toMatchObject({ batchId: batches[0].id, quantity: 2.5, senderKey: SENDER, customerName: "Sari" });
    expect(texts(replies)).toContain(`kode ${shortCode(deps.state.orders[0].id)}`);
    expect(await session(deps)).toBeNull();
  });

  it("ORDER_CONFIRM setelah batch ditutup membalas pesan sudah ditutup dan writes kosong", async () => {
    const { deps, batches } = setup();
    await presentAction({ type: "confirm_join", batchId: batches[0].id, quantity: 5 }, await contextFor(deps));
    batches[0].acceptingOrders = false;
    const replies = await press(deps, BUTTON.ORDER_CONFIRM);

    expect(texts(replies)).toContain("sudah ditutup");
    expect(deps.writes).toEqual([]);
    expect(deps.state.orders).toEqual([]);
    expect(await session(deps)).toBeNull();
  });

  it("CHANGE_CONFIRM tanpa sesi membalas kedaluwarsa dan writes kosong", async () => {
    const { deps } = setup();
    await seedOrder(deps);
    const replies = await press(deps, BUTTON.CHANGE_CONFIRM);

    expect(replies).toEqual([{ kind: "text", body: "Pilihan ini sudah kedaluwarsa. Ketik MULAI atau PESANAN ya.", aiGenerated: false }]);
    expect(deps.writes).toEqual([]);
  });

  it("CHANGE_CONFIRM dengan sesi yang sudah lewat expiresAt membalas kedaluwarsa dan writes kosong", async () => {
    const { deps } = setup();
    const id = await seedOrder(deps);
    await presentAction({ type: "confirm_change", orderCode: shortCode(id), quantity: 12 }, await contextFor(deps));
    const stale = { ...(await session(deps))!, expiresAt: new Date(FIXTURE_NOW.getTime() - 1).toISOString() };
    const replies = await executeConfirmation(BUTTON.CHANGE_CONFIRM, stale, await contextFor(deps));

    expect(texts(replies)).toContain("sudah kedaluwarsa");
    expect(deps.writes).toEqual([]);
    expect(deps.state.orders[0].quantity).toBe(5);
  });

  it("ORDER_CONFIRM dengan sesi stage lain membalas kedaluwarsa", async () => {
    const { deps, batches } = setup();
    await presentAction({ type: "ask_quantity", batchId: batches[0].id }, await contextFor(deps));
    const replies = await press(deps, BUTTON.ORDER_CONFIRM);

    expect(texts(replies)).toContain("sudah kedaluwarsa");
    expect(deps.writes).toEqual([]);
  });

  it("CHANGE_CONFIRM mengubah jumlah pesanan", async () => {
    const { deps } = setup();
    const id = await seedOrder(deps);
    await presentAction({ type: "confirm_change", orderCode: shortCode(id), quantity: 12 }, await contextFor(deps));
    const replies = await press(deps, BUTTON.CHANGE_CONFIRM);

    expect(deps.writes.map((w) => w.kind)).toEqual(["update"]);
    expect(deps.state.orders[0].quantity).toBe(12);
    expect(texts(replies)).toBe(`Pesanan ${shortCode(id)} diubah menjadi 12 kg.`);
    expect(await session(deps)).toBeNull();
  });

  it("CHANGE_CONFIRM setelah pesanan dibatalkan dari kanal lain membalas tidak ditemukan", async () => {
    const { deps } = setup();
    const id = await seedOrder(deps);
    await presentAction({ type: "confirm_change", orderCode: shortCode(id), quantity: 12 }, await contextFor(deps));
    deps.state.orders[0].status = "cancelled";
    const replies = await press(deps, BUTTON.CHANGE_CONFIRM);

    expect(texts(replies)).toContain("tidak ditemukan");
    expect(deps.writes).toEqual([]);
    expect(await session(deps)).toBeNull();
  });

  it("CHANGE_CONFIRM dengan daftar pesanan basi tetap ditolak port dan errornya dikirim", async () => {
    const { deps } = setup();
    const id = await seedOrder(deps);
    await presentAction({ type: "confirm_change", orderCode: shortCode(id), quantity: 12 }, await contextFor(deps));
    const staleCtx = await contextFor(deps);
    deps.state.orders[0].status = "cancelled";
    const replies = await executeConfirmation(BUTTON.CHANGE_CONFIRM, await session(deps), staleCtx);

    expect(texts(replies)).toBe("Pesanan tidak ditemukan. Periksa kode pengelolaan.");
    expect(deps.writes).toEqual([]);
  });

  it("CANCEL_CONFIRM membatalkan pesanan", async () => {
    const { deps } = setup();
    const id = await seedOrder(deps);
    await presentAction({ type: "confirm_cancel", orderCode: shortCode(id) }, await contextFor(deps));
    const replies = await press(deps, BUTTON.CANCEL_CONFIRM);

    expect(deps.writes.map((w) => w.kind)).toEqual(["cancel"]);
    expect(texts(replies)).toBe(`Pesanan ${shortCode(id)} dibatalkan.`);
  });

  it("INTEREST_CONFIRM mencatat minat dengan frequency mingguan", async () => {
    const { deps } = setup();
    const replies = await presentAction(
      { type: "confirm_interest", material: "Telur Ayam", quantity: 10, unit: "kg", frequency: "mingguan" },
      await contextFor(deps),
    );
    if (replies[0].kind !== "buttons") throw new Error("expected buttons");
    expect(replies[0].buttons).toEqual([
      { id: BUTTON.INTEREST_CONFIRM, title: "Ya, catat" },
      { id: BUTTON.DISMISS, title: "Batalkan" },
    ]);
    expect(deps.writes).toEqual([]);

    await press(deps, BUTTON.INTEREST_CONFIRM);
    expect(deps.writes.map((w) => w.kind)).toEqual(["interest"]);
    expect(deps.state.interests[0]).toMatchObject({
      channel: "whatsapp", senderKey: SENDER, material: "Telur Ayam", quantity: 10, unit: "kg", frequency: "mingguan",
    });
    expect(await session(deps)).toBeNull();
  });

  it("ACTION_DISMISS menghapus sesi tanpa writes", async () => {
    const { deps, batches } = setup();
    await presentAction({ type: "confirm_join", batchId: batches[0].id, quantity: 5 }, await contextFor(deps));
    const replies = await press(deps, BUTTON.DISMISS);

    expect(texts(replies)).toContain("Pilihan dibatalkan");
    expect(await session(deps)).toBeNull();
    expect(deps.writes).toEqual([]);
  });
});
