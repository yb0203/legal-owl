import type { createClient } from "@/lib/supabase/server";
import type { NormalizedCase } from "@/lib/ecourts/types";
import { getSystemStateId } from "@/lib/db";

type DB = Awaited<ReturnType<typeof createClient>>;

// The minimal matter state the diff needs (current projections to compare against).
export interface MatterSyncRow {
  id: string;
  lawyer_id: string;
  court_status: string | null;
  next_hearing_date: string | null;
}

export interface SyncSummary {
  created: number; // new activity rows appended
  hearings: number; // hearing tasks upserted
  triaged: number; // inbox (Triage-state) tasks raised
}

interface DerivedEvent {
  event_type: string;
  previous_value: string | null;
  new_value: string | null;
  occurred_at: string;
  content_hash: string;
  kind: string; // triage kind
  summary: string; // triage summary
}

// The single writer: diff a normalized case against the matter's stored state and
// land changes idempotently into the append-only `activity` timeline, upsert
// hearing tasks, update the matter projections, and raise Triage-state tasks
// (the Inbox) for material changes. Re-syncing the same response is a no-op
// (activity content_hash uniqueness + hearing read-then-write dedup).
export async function syncMatter(
  supabase: DB,
  matter: MatterSyncRow,
  c: NormalizedCase,
): Promise<SyncSummary> {
  const { id: matter_id, lawyer_id } = matter;
  const now = new Date().toISOString();
  const derived: DerivedEvent[] = [];

  if (c.court_status && c.court_status !== matter.court_status) {
    derived.push({
      event_type: "status_changed",
      previous_value: matter.court_status,
      new_value: c.court_status,
      occurred_at: now,
      content_hash: `sync:status:${c.court_status}`,
      kind: "status_changed",
      summary: `Case status changed to ${c.court_status}`,
    });
  }
  if (c.next_hearing_date && c.next_hearing_date !== matter.next_hearing_date) {
    derived.push({
      event_type: "hearing_date_changed",
      previous_value: matter.next_hearing_date,
      new_value: c.next_hearing_date,
      occurred_at: now,
      content_hash: `sync:nhd:${c.next_hearing_date}`,
      kind: "hearing_date_changed",
      summary: `Hearing listed for ${c.next_hearing_date}`,
    });
  }
  for (const o of c.orders) {
    derived.push({
      event_type: "order_uploaded",
      previous_value: null,
      new_value: o.url ?? "Order uploaded",
      occurred_at: o.order_date,
      content_hash: `sync:order:${o.order_date}:${o.url ?? ""}`,
      kind: "order_uploaded",
      summary: `New order dated ${o.order_date}`,
    });
  }

  // Append activity rows idempotently; `.select()` returns ONLY newly-inserted
  // rows (ON CONFLICT DO NOTHING), so triage fires once per genuinely-new change.
  let triaged = 0;
  let created = 0;
  if (derived.length) {
    const { data: inserted } = await supabase
      .from("activity")
      .upsert(
        derived.map((e) => ({
          lawyer_id,
          matter_id,
          kind: "court_event",
          event_type: e.event_type,
          previous_value: e.previous_value,
          new_value: e.new_value,
          occurred_at: e.occurred_at,
          source: "ecourt",
          content_hash: e.content_hash,
        })),
        { onConflict: "matter_id,content_hash", ignoreDuplicates: true },
      )
      .select("content_hash");
    const freshHashes = new Set((inserted ?? []).map((r) => r.content_hash as string));
    created = freshHashes.size;

    // Each genuinely-new change becomes a Triage-state task (the Inbox). Keyless;
    // a key is minted on accept. triage_kind drives the Inbox KIND chip.
    const triageId = await getSystemStateId(supabase, "Triage");
    const triage = derived.filter((e) => freshHashes.has(e.content_hash));
    if (triage.length && triageId) {
      await supabase.from("tasks").insert(
        triage.map((e) => ({
          lawyer_id,
          matter_id,
          type: "task",
          state_id: triageId,
          title: e.summary,
          source: "triage",
          attributes: { triage_kind: e.kind },
        })),
      );
      triaged = triage.length;
    }
  }

  // Hearing tasks: read-then-write dedup on due_date (no jsonb upsert). Existing
  // dates get their court_state/purpose/outcome refreshed; new dates inserted.
  // The API history has no outcome field, so derive held/scheduled from the date.
  if (c.hearings.length) {
    const today = now.slice(0, 10);
    const { data: existing } = await supabase
      .from("tasks")
      .select("id, due_date, attributes")
      .eq("matter_id", matter_id)
      .eq("type", "hearing");
    const byDate = new Map((existing ?? []).map((h) => [h.due_date as string, h]));
    const queued = new Set<string>(); // guard against the same date repeating in one response
    const toInsert: Record<string, unknown>[] = [];
    for (const h of c.hearings) {
      const court_state = h.hearing_date < today ? "held" : "scheduled";
      const found = byDate.get(h.hearing_date);
      if (found) {
        const prev = (found.attributes as Record<string, unknown>) ?? {};
        // Never clobber a hearing the lawyer has recorded an outcome on — the
        // synced history has no outcome field, so re-syncing would null it out.
        if (!prev.outcome) {
          const attributes = {
            ...prev,
            purpose: h.purpose ?? prev.purpose ?? null,
            outcome: h.outcome ?? null,
            court_state,
          };
          await supabase.from("tasks").update({ attributes }).eq("id", found.id as string);
        }
      } else if (!queued.has(h.hearing_date)) {
        queued.add(h.hearing_date);
        toInsert.push({
          lawyer_id,
          matter_id,
          type: "hearing",
          title: h.purpose ?? "Hearing",
          due_date: h.hearing_date,
          source: "sync",
          attributes: { purpose: h.purpose, outcome: h.outcome, court_state },
        });
      }
    }
    if (toInsert.length) await supabase.from("tasks").insert(toInsert);
  }

  // Update matter projections (court_status/next-hearing are eCourts-owned; the
  // lawyer's matter_status is left untouched). lifecycle reflects sync disposition.
  await supabase
    .from("matters")
    .update({
      court_status: c.court_status ?? matter.court_status,
      next_hearing_date: c.next_hearing_date ?? matter.next_hearing_date,
      lifecycle_state: c.lifecycle_hint,
      last_successful_sync_at: now,
    })
    .eq("id", matter_id);

  return { created, hearings: c.hearings.length, triaged };
}

// CNR did not resolve — flag the matter without wiping prior data.
export async function markUnresolved(supabase: DB, matterId: string): Promise<void> {
  await supabase.from("matters").update({ lifecycle_state: "not_found" }).eq("id", matterId);
}
