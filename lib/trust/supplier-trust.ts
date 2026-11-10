import "server-only";
import { generateText } from "ai";
import { selectStage2Model } from "@/lib/agent/model-provider";
import type { BatchStatus } from "@/lib/batch";
import { createSupabaseAdminClient, hasSupabaseSecret } from "@/lib/supabase/server";
import { resolveSummary, SUMMARY_INSTRUCTIONS, supplierFacts, type Summarizer, type SupplierFacts, type SummaryResult } from "@/lib/trust/supplier";

export type SupplierTrust = { facts: SupplierFacts } & SummaryResult;

function summarizerFromEnv(): Summarizer | null {
  if (process.env.AGENT_ENABLED === "false") return null;
  const selected = selectStage2Model(process.env);
  if (!selected) return null;
  return async (prompt, signal) => {
    const result = await generateText({
      model: selected.model,
      providerOptions: selected.providerOptions,
      instructions: SUMMARY_INSTRUCTIONS,
      prompt,
      maxOutputTokens: 200,
      abortSignal: signal,
    });
    return result.text;
  };
}

/** Fakta dari database plus ringkasan 1–2 kalimat; dirender di server dengan batas waktu 5 detik untuk model. */
export async function loadSupplierTrust(supplierId: string): Promise<SupplierTrust | null> {
  if (!hasSupabaseSecret() || !supplierId) return null;
  const supabase = createSupabaseAdminClient();
  const [supplier, batches, orders] = await Promise.all([
    supabase.from("suppliers").select("display_name, is_verified, verification_note, created_at, trust_summary, trust_summary_at, trust_facts_hash").eq("id", supplierId).maybeSingle(),
    supabase.from("patungans").select("status").eq("supplier_id", supplierId),
    supabase.from("orders").select("fulfillment_status, patungans!inner(supplier_id, status)").eq("status", "confirmed").eq("patungans.supplier_id", supplierId).eq("patungans.status", "successful"),
  ]);
  if (supplier.error || batches.error || orders.error || !supplier.data) return null;

  const row = supplier.data;
  const facts = supplierFacts({
    name: row.display_name,
    verified: row.is_verified,
    verificationNote: row.verification_note ?? "",
    createdAt: row.created_at,
    batches: batches.data.map((batch) => ({ status: batch.status as BatchStatus })),
    successfulOrders: orders.data.map((order) => ({ fulfillmentStatus: order.fulfillment_status })),
  });
  const cached = row.trust_summary && row.trust_summary_at && row.trust_facts_hash
    ? { summary: row.trust_summary, at: row.trust_summary_at, hash: row.trust_facts_hash }
    : null;
  const result = await resolveSummary({ facts, cached, now: new Date(), summarize: summarizerFromEnv() });
  if (result.source !== "cache") {
    // Template juga disimpan supaya kuota model tidak terpakai di setiap render saat model gagal.
    await supabase.from("suppliers").update({ trust_summary: result.summary, trust_summary_at: new Date().toISOString(), trust_facts_hash: result.hash }).eq("id", supplierId);
  }
  return { facts, ...result };
}
