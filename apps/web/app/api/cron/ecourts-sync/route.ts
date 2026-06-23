import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncOneMatter } from "@/lib/ecourts/run";
import type { MatterSyncRow } from "@/lib/ecourts/sync";

// Nightly portfolio sync. Vercel Cron hits this; it is NOT a user route — it uses
// the service-role client (no user session) and is guarded by CRON_SECRET. Walks
// every matter with a CNR, runs the diff engine, and lets new changes land in
// each lawyer's Inbox. A per-account daily cap bounds credit spend.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DAILY_CAP = 500; // global ceiling per run — tune against the dashboard limits

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: matters } = await admin
    .from("matters")
    .select("id, lawyer_id, cnr, court_status, next_hearing_date")
    .not("cnr", "is", null)
    .neq("lifecycle_state", "disposed")
    .limit(DAILY_CAP)
    .returns<(MatterSyncRow & { cnr: string | null })[]>();

  let synced = 0;
  let changed = 0;
  let failed = 0;
  for (const m of matters ?? []) {
    // The admin client bypasses RLS; syncOneMatter writes are scoped by lawyer_id.
    const r = await syncOneMatter(admin as never, m);
    if (r.ok) {
      synced += 1;
      if (r.summary.created > 0) changed += 1;
    } else if (r.reason !== "no_cnr") {
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, total: matters?.length ?? 0, synced, changed, failed });
}
