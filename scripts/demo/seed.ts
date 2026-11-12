import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import prediksi from "@/ai/harga/output/prediksi.json";
import { createStage2FromEnv } from "@/lib/agent/model-provider";
import { loadIntentClassifier } from "@/lib/agent/stage1/classifier";
import { BUTTON } from "@/lib/agent/types";
import { withCache } from "@/evals/cache";
import { runScenario, type Scenario } from "@/evals/scenario";
import { BATCH_IMAGE_BUCKET } from "@/lib/batch-image";
import { ROLES, type Role } from "@/lib/roles";
import { buildDemoPlan, DEMO_COMMODITIES, DEMO_SENDER_PREFIX } from "./plan";

const { values: args } = parseArgs({ options: { "tanpa-llm": { type: "boolean", default: false } } });

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} belum diisi di .env.local`);
  return value;
}

const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});

function check<R extends { data: unknown; error: { message: string } | null }>(label: string, result: R): NonNullable<R["data"]> {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data as NonNullable<R["data"]>;
}

async function findUserId(client: SupabaseClient, email: string) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (data.users.length < 1000) return null;
  }
}

async function ensureDemoUser(role: Role) {
  const email = requireEnv(`DEMO_${role.toUpperCase()}_EMAIL`);
  const password = requireEnv(`DEMO_${role.toUpperCase()}_PASSWORD`);
  const attributes = { password, email_confirm: true, app_metadata: { role, demo: true } };
  const existing = await findUserId(supabase, email);
  if (existing) {
    check(`update ${email}`, await supabase.auth.admin.updateUserById(existing, attributes));
    return existing;
  }
  return check(`create ${email}`, await supabase.auth.admin.createUser({ email, ...attributes })).user!.id;
}

async function clearSeed() {
  check("reset_demo_data", await supabase.rpc("reset_demo_data"));
  const seedBatches = check("seed batches", await supabase.from("patungans").select("id").not("demo_seed", "is", null));
  const ids = seedBatches.map((row) => row.id as string);
  if (ids.length) check("hapus pesanan batch seed", await supabase.from("orders").delete().in("patungan_id", ids));
  check("hapus pesanan seed", await supabase.from("orders").delete().not("demo_seed", "is", null));
  check("hapus batch seed", await supabase.from("patungans").delete().not("demo_seed", "is", null));
  check("hapus minat seed", await supabase.from("demand_interests").delete().not("demo_seed", "is", null));
  check("hapus trace seed", await supabase.from("agent_traces").delete().like("sender_hash", `${DEMO_SENDER_PREFIX}%`));
}

const SUPPLIER_NAME = "Grosir Demo";
const SUPPLIER_SEED = { is_verified: true, verification_note: "NIB dan gudang diperiksa tim GroUp (data demo)." };

async function ensureSupplier(ownerId: string) {
  const { data: owned, error } = await supabase.from("suppliers").select("id").eq("owner_user_id", ownerId).maybeSingle();
  if (error) throw new Error(`supplier: ${error.message}`);
  const fields = { display_name: SUPPLIER_NAME, owner_user_id: ownerId, ...SUPPLIER_SEED, verified_at: new Date().toISOString(), demo_seed: SUPPLIER_SEED, updated_at: new Date().toISOString() };
  if (owned) {
    check("update supplier", await supabase.from("suppliers").update(fields).eq("id", owned.id));
    return owned.id as string;
  }
  const joined = new Date(Date.now() - 120 * 86_400_000).toISOString();
  return check("insert supplier", await supabase.from("suppliers").insert({ ...fields, created_at: joined }).select("id").single()).id as string;
}

/** Foto di images/, diunggah ulang setiap seed agar URL-nya selalu ada. */
async function uploadImages() {
  const urls: Record<string, string> = {};
  for (const commodity of DEMO_COMMODITIES) {
    const path = `demo/${commodity}.jpg`;
    const file = await readFile(new URL(`./images/${commodity}.jpg`, import.meta.url));
    check(`upload ${path}`, await supabase.storage.from(BATCH_IMAGE_BUCKET).upload(path, file, { contentType: "image/jpeg", upsert: true }));
    urls[commodity] = supabase.storage.from(BATCH_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  }
  return urls;
}

const SCENARIOS: Scenario[] = [
  ["menu"],
  ["mau ikut cabe 5 kilo", BUTTON.ORDER_CONFIRM],
  ["harga bawang merah di pasar berapa?"],
  ["pesanan"],
  ["ada batch telur?", "10"],
  ["saya butuh tepung terigu 3 sak tiap bulan", BUTTON.INTEREST_CONFIRM],
  ["ikut ayam 12 kg", BUTTON.DISMISS],
  ["kapan batch cabai ditutup?"],
  ["halo kak"],
  ["mulai"],
  ["bisa antar ke cimahi?"],
  ["harga gula pasir sekarang berapa ya"],
].map((turns, index) => ({
  id: `demo-${index}`,
  turns: turns.map((text) => (Object.values(BUTTON).includes(text as never) ? { replyId: text } : { text })),
  expect: { orders: [] },
}));

async function simulateTraces(batches: Parameters<typeof runScenario>[1]["batches"], target: number) {
  const classifier = await loadIntentClassifier();
  // Skenario diulang beberapa putaran; cache membuat pesan yang sama hanya memanggil LLM sekali.
  const base = args["tanpa-llm"] ? null : createStage2FromEnv(process.env);
  const stage2 = base && withCache(base, { dir: "evals/cache/demo-seed" });
  const rows: Record<string, unknown>[] = [];
  const spanMs = 14 * 86_400_000;
  for (let round = 0; rows.length < target; round += 1) {
    for (const scenario of SCENARIOS) {
      const result = await runScenario({ ...scenario, id: `${scenario.id}-${round}` }, { batches, classifier, stage2 });
      const sender = `${DEMO_SENDER_PREFIX}${createHash("sha256").update(`${round}:${scenario.id}`).digest("hex").slice(0, 12)}`;
      result.traces.forEach((trace) => rows.push({
        channel: "simulator",
        sender_hash: sender,
        stage: trace.stage,
        intent: trace.intent,
        confidence: trace.confidence,
        action: trace.action,
        model: trace.model,
        input_tokens: trace.inputTokens,
        output_tokens: trace.outputTokens,
        latency_ms: Math.round(trace.latencyMs),
        tools: trace.tools?.length ? trace.tools : null,
        created_at: new Date(Date.now() - ((rows.length * 7_919_000) % spanMs)).toISOString(),
      }));
      if (rows.length >= target) break;
    }
  }
  return { rows, usedClassifier: Boolean(classifier), usedStage2: Boolean(stage2) };
}

const ids = Object.fromEntries(await Promise.all(ROLES.map(async (role) => [role, await ensureDemoUser(role)] as const))) as Record<Role, string>;
await clearSeed();
const supplierId = await ensureSupplier(ids.grosir);
const imageUrls = await uploadImages();
const plan = buildDemoPlan({
  market: prediksi.prediksi,
  now: new Date(),
  supplierId,
  supplierName: SUPPLIER_NAME,
  grosirId: ids.grosir,
  buyerId: ids.pembeli,
  uuid: randomUUID,
  codeHash: () => createHash("sha256").update(randomBytes(18).toString("base64url")).digest("hex"),
  imageUrl: (commodity) => imageUrls[commodity],
});

check("insert batch", await supabase.from("patungans").insert(plan.batches));
check("insert tier", await supabase.from("patungan_price_tiers").insert(plan.tiers));
check("insert pesanan", await supabase.from("orders").insert(plan.orders));
check("insert minat", await supabase.from("demand_interests").insert(plan.interests));
const traces = await simulateTraces(plan.openBatches, 200);
check("insert trace", await supabase.from("agent_traces").insert(traces.rows));

console.log([
  "Data demo siap:",
  `- 3 akun demo (${ROLES.join(", ")})`,
  `- supplier ${SUPPLIER_NAME} milik akun grosir demo, terverifikasi`,
  `- ${plan.batches.length} batch dengan foto bahan, ${plan.orders.length} pesanan, ${plan.interests.length} minat permintaan`,
  `- ${traces.rows.length} trace agen dari ${SCENARIOS.length} skenario simulator (classifier: ${traces.usedClassifier ? "ya" : "belum ada"}, LLM tahap 2: ${traces.usedStage2 ? "ya" : "tidak"})`,
].join("\n"));
