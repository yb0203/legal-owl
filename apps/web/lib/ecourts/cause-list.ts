// Cause list integration — free, no API credits.
// Fetches the daily court schedule for all active matters, matches entries to
// stored matters by CNR, and writes them to the activity table for display on
// the Home page "Courts today" section.
// Server-only.

import type { createClient } from "@/lib/supabase/server";
import { getCauseList } from "@/lib/ecourts/client";

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

/** Extract the court code from a CNR (first 4 chars: e.g. "MPHC" from "MPHC010004222025"). */
function courtCodeFromCnr(cnr: string): string {
  return cnr.slice(0, 4).toUpperCase();
}

/** Idempotency hash for a cause list entry (date + matter + serial). */
function causeListHash(date: string, matterId: string, serial: number | null): string {
  return `cl:${date}:${matterId}:${serial ?? "?"}`;
}

/**
 * Fetch today's cause list for all active matters that have a CNR.
 * Writes matched entries to the activity table and returns them for Home page display.
 * Best-effort — errors are logged, never thrown.
 */
export async function fetchAndStoreCauseList(
  supabase: DB,
  date: string, // yyyy-mm-dd (IST today)
): Promise<CauseListEntry[]> {
  // 1. Load active matters with a CNR.
  const { data: matters } = await supabase
    .from("matters")
    .select("id, title, cnr, lawyer_id")
    .not("cnr", "is", null)
    .neq("lifecycle_state", "disposed")
    .neq("lifecycle_state", "not_found");

  if (!matters?.length) return [];

  // 2. Group by court code (first 4 chars of CNR) so we fetch one cause list per court.
  const byCourt = new Map<string, typeof matters>();
  for (const m of matters) {
    if (!m.cnr) continue;
    const code = courtCodeFromCnr(m.cnr);
    if (!byCourt.has(code)) byCourt.set(code, []);
    byCourt.get(code)!.push(m);
  }

  // Build a CNR → matter index for fast matching.
  const byCnr = new Map(matters.filter((m) => m.cnr).map((m) => [m.cnr as string, m]));

  const entries: CauseListEntry[] = [];

  for (const [courtCode, courtMatters] of byCourt) {
    let body: unknown;
    try {
      const res = await getCauseList({ date, courtCode });
      if (!res.ok) continue;
      body = res.body;
    } catch {
      continue; // best-effort
    }

    // The cause list response shape is pending live verification.
    // Defensive parse: expect { data: { items: Array<{ cnr, serialNo, slotTime, purpose }> } }
    const items = (body as { data?: { items?: unknown[] } })?.data?.items ?? [];

    for (const raw of items) {
      const item = raw as {
        cnr?: string;
        serialNo?: number;
        slotTime?: string;
        purpose?: string;
      };
      if (!item.cnr) continue;
      const matter = byCnr.get(item.cnr);
      if (!matter) continue; // not one of our matters

      const entry: CauseListEntry = {
        matter_id: matter.id as string,
        matter_title: matter.title as string,
        cnr: item.cnr,
        court_code: courtCode,
        serial_no: item.serialNo ?? null,
        slot_time: item.slotTime ?? null,
        purpose: item.purpose ?? null,
      };
      entries.push(entry);

      // Write to activity table (idempotent via content_hash).
      try {
        await supabase.from("activity").upsert(
          {
            lawyer_id: matter.lawyer_id,
            matter_id: matter.id,
            kind: "court_event",
            event_type: "cause_list_entry",
            new_value: `Listed at ${courtCode}${entry.serial_no ? ` #${entry.serial_no}` : ""}${entry.slot_time ? ` · ${entry.slot_time}` : ""}`,
            occurred_at: date,
            source: "ecourt",
            content_hash: causeListHash(date, matter.id as string, entry.serial_no),
          },
          { onConflict: "matter_id,content_hash", ignoreDuplicates: true },
        );
      } catch {
        // Don't let a write failure block the UI data.
      }
    }
  }

  // Sort by serial number (nulls last).
  return entries.sort((a, b) => {
    if (a.serial_no === null) return 1;
    if (b.serial_no === null) return -1;
    return a.serial_no - b.serial_no;
  });
}
