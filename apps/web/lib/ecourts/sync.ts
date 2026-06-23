import type { createClient } from "@/lib/supabase/server";
import type { NormalizedCase } from "@/lib/ecourts/types";

type DB = Awaited<ReturnType<typeof createClient>>;

// The minimal matter state the diff needs (current projections to compare against).
export interface MatterSyncRow {
  id: string;
  lawyer_id: string;
  court_status: string | null;
  next_hearing_date: string | null;
}

export interface SyncSummary {
  created: number; // new court_events appended
  hearings: number; // hearings upserted
  triaged: number; // inbox items raised
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
// land changes idempotently into the append-only court_events, upsert hearings,
// update the matter projections, and raise triage items for material changes.
// Re-syncing the same response is a no-op (content_hash uniqueness).
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

  // Append events idempotently; `.select()` returns ONLY newly-inserted rows
  // (ON CONFLICT DO NOTHING), so triage fires once per genuinely-new change.
  let triaged = 0;
  let created = 0;
  if (derived.length) {
    const { data: inserted } = await supabase
      .from("court_events")
      .upsert(
        derived.map((e) => ({
          lawyer_id,
          matter_id,
          event_type: e.event_type,
          previous_value: e.previous_value,
          new_value: e.new_value,
          occurred_at: e.occurred_at,
          source_type: "ecourt",
          content_hash: e.content_hash,
        })),
        { onConflict: "matter_id,content_hash", ignoreDuplicates: true },
      )
      .select("content_hash");
    const freshHashes = new Set((inserted ?? []).map((r) => r.content_hash as string));
    created = freshHashes.size;
    const triage = derived
      .filter((e) => freshHashes.has(e.content_hash))
      .map((e) => ({ lawyer_id, matter_id, kind: e.kind, summary: e.summary, state: "pending" }));
    if (triage.length) {
      await supabase.from("triage_items").insert(triage);
      triaged = triage.length;
    }
  }

  // Upsert hearings (idempotent on matter_id+hearing_date+ordinal). The API
  // history has no outcome field, so derive held/scheduled from the date.
  if (c.hearings.length) {
    const today = now.slice(0, 10);
    await supabase.from("hearings").upsert(
      c.hearings.map((h) => ({
        lawyer_id,
        matter_id,
        hearing_date: h.hearing_date,
        purpose: h.purpose,
        outcome: h.outcome,
        source: "ecourt",
        state: h.hearing_date < today ? "held" : "scheduled",
        ordinal: 0,
      })),
      { onConflict: "matter_id,hearing_date,ordinal", ignoreDuplicates: false },
    );
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
      last_event_at: now,
    })
    .eq("id", matter_id);

  return { created, hearings: c.hearings.length, triaged };
}

// CNR did not resolve — flag the matter without wiping prior data.
export async function markUnresolved(supabase: DB, matterId: string): Promise<void> {
  await supabase.from("matters").update({ lifecycle_state: "not_found" }).eq("id", matterId);
}
