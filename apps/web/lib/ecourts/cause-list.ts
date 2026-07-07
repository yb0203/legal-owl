// Cause list integration — free, no API credits.
// Fetches the daily court schedule for all active matters that have a CNR,
// matches returned slots by CNR, and returns them for Home page display.
// Server-only.

import type { createClient } from "@/lib/supabase/server";
import { getCauseList } from "@/lib/ecourts/client";
import { courtCodeFromCnr } from "@/lib/ecourts/types";

type DB = Awaited<ReturnType<typeof createClient>>;

export interface CauseListEntry {
  matter_id: string;
  matter_title: string;
  cnr: string;
  court_code: string;
  serial_no: number | null;
  slot_time: string | null;
  purpose: string | null;
}

export type CauseListResult =
  | { status: "ok"; entries: CauseListEntry[] }
  | { status: "no_cnrs" }           // no active matters have CNRs
  | { status: "api_unavailable" }   // ECOURTS_API_KEY not set
  | { status: "empty" }             // API returned but no listings today
  | { status: "error"; message: string };

/** Idempotency hash for a cause list entry. */
function causeListHash(date: string, matterId: string, serial: number | null): string {
  return `cl:${date}:${matterId}:${serial ?? "?"}`;
}

/**
 * Fetch today's cause list for all active matters with a CNR.
 * Uses the 6-char cnrCourtCode (e.g. "MPHC03") stored on the matter,
 * falling back to extracting it from the CNR string.
 */
export async function fetchCauseList(
  supabase: DB,
  date: string,
): Promise<CauseListResult> {
  if (!process.env.ECOURTS_API_KEY) return { status: "api_unavailable" };

  // Load active matters with a CNR.
  const { data: matters, error } = await supabase
    .from("matters")
    .select("id, title, cnr, court_code, lawyer_id")
    .not("cnr", "is", null)
    .neq("lifecycle_state", "disposed")
    .neq("lifecycle_state", "not_found");

  if (error) return { status: "error", message: error.message };
  if (!matters?.length) return { status: "no_cnrs" };

  // Group by court code. Prefer the stored court_code column; fall back to CNR extraction.
  const byCourt = new Map<string, typeof matters>();
  for (const m of matters) {
    if (!m.cnr) continue;
    const code = (m.court_code as string | null) ?? courtCodeFromCnr(m.cnr as string);
    if (!byCourt.has(code)) byCourt.set(code, []);
    byCourt.get(code)!.push(m);
  }

  // CNR → matter index for matching API results.
  const byCnr = new Map(
    matters.filter((m) => m.cnr).map((m) => [m.cnr as string, m]),
  );

  const entries: CauseListEntry[] = [];

  for (const [courtCode] of byCourt) {
    let body: unknown;
    try {
      const res = await getCauseList({ date, courtCode });
      if (!res.ok) {
        console.warn(`[cause-list] GET /causelist/search failed for court ${courtCode}`);
        continue;
      }
      body = res.body;
      // Debug: log raw response shape so we can verify field names against live API.
      if (process.env.NODE_ENV === "development") {
        console.log(`[cause-list] raw response for ${courtCode}:`, JSON.stringify(body).slice(0, 500));
      }
    } catch (err) {
      console.error("[cause-list] fetch error:", err);
      continue;
    }

    // Defensive parse — the exact shape is pending live verification.
    // The API may return items under data.cases, data.items, data.causeList, etc.
    const rawBody = body as Record<string, unknown>;
    const dataSection = (rawBody?.data ?? rawBody) as Record<string, unknown>;
    const items = (
      dataSection?.items ??
      dataSection?.cases ??
      dataSection?.causeList ??
      dataSection?.listings ??
      []
    ) as unknown[];

    for (const raw of items) {
      const item = raw as {
        cnr?: string;
        caseNo?: string;
        serialNo?: number | string;
        slotTime?: string;
        time?: string;
        purpose?: string;
        purposeOfListing?: string;
      };

      const cnr = item.cnr ?? item.caseNo;
      if (!cnr) continue;

      const matter = byCnr.get(cnr);
      if (!matter) continue; // not one of our matters

      const serial =
        item.serialNo != null ? Number(item.serialNo) : null;

      const entry: CauseListEntry = {
        matter_id: matter.id as string,
        matter_title: matter.title as string,
        cnr,
        court_code: courtCode,
        serial_no: Number.isNaN(serial) ? null : serial,
        slot_time: item.slotTime ?? item.time ?? null,
        purpose: item.purpose ?? item.purposeOfListing ?? null,
      };
      entries.push(entry);

      // Write to activity table idempotently.
      try {
        await supabase.from("activity").upsert(
          {
            lawyer_id: matter.lawyer_id,
            matter_id: matter.id,
            kind: "court_event",
            event_type: "cause_list_entry",
            new_value: `Listed at ${courtCode}${entry.serial_no != null ? ` #${entry.serial_no}` : ""}`,
            occurred_at: date,
            source: "ecourt",
            content_hash: causeListHash(date, matter.id as string, entry.serial_no),
          },
          { onConflict: "matter_id,content_hash", ignoreDuplicates: true },
        );
      } catch {
        // Write failure never blocks the UI.
      }
    }
  }

  if (entries.length === 0) return { status: "empty" };

  return {
    status: "ok",
    entries: entries.sort((a, b) => {
      if (a.serial_no === null) return 1;
      if (b.serial_no === null) return -1;
      return a.serial_no - b.serial_no;
    }),
  };
}
