import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { error } = await createSupabaseAdminClient().rpc("cleanup_agent_data");
  if (error) {
    console.error("cleanup_agent_data gagal", error);
    return NextResponse.json({ error: "Pembersihan data agen gagal." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
