import type { createClient } from "@/lib/supabase/server";
import { getCase, getEnums } from "@/lib/ecourts/client";
import { normalizeCase } from "@/lib/ecourts/normalize";
import { syncMatter, markUnresolved, type MatterSyncRow, type SyncSummary } from "@/lib/ecourts/sync";

type DB = Awaited<ReturnType<typeof createClient>>;

export type RunResult =
  | { ok: true; summary: SyncSummary }
  | { ok: false; reason: "not_found" | "rate_limited" | "unauthorized" | "error" | "no_cnr" };

// Fetch → normalize → diff one matter. The single entry point shared by the
// connect flow, "Sync now", and the nightly cron. Marks not-found CNRs without
// wiping data. Bills one successful API call per matter.
export async function syncOneMatter(
  supabase: DB,
  matter: MatterSyncRow & { cnr: string | null },
): Promise<RunResult> {
  if (!matter.cnr) return { ok: false, reason: "no_cnr" };
  const res = await getCase(matter.cnr);
  if (!res.ok) {
    if (res.reason === "not_found") await markUnresolved(supabase, matter.id);
    return { ok: false, reason: res.reason };
  }
  const enums = await getEnums();
  const normalized = normalizeCase(res.data, enums);
  const summary = await syncMatter(supabase, matter, normalized);
  return { ok: true, summary };
}
