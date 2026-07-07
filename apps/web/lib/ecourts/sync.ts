import type { createClient } from "@/lib/supabase/server";
import type { NormalizedCase } from "@/lib/ecourts/types";
import { getSystemStateId } from "@/lib/db";
import { ingestOrder } from "@/lib/ecourts/ingest";

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
  events: SyncEvent[]; // the genuinely-new court_event rows (interactive syncs hand these to agents)
}

/** A newly-appended court_event row — the payload Court Scout reacts to. */
export interface SyncEvent {
  id: string;
  event_type: string;
  previous_value: string | null;
  new_value: string | null;
  occurred_at: string | null;
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
  let events: SyncEvent[] = [];
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
      .select("id, content_hash, event_type, previous_value, new_value, occurred_at");
    const rows = inserted ?? [];
    const freshHashes = new Set(rows.map((r) => r.content_hash as string));
    created = freshHashes.size;
    events = rows.map((r) => ({
      id: r.id as string,
      event_type: r.event_type as string,
      previous_value: (r.previous_value as string | null) ?? null,
      new_value: (r.new_value as string | null) ?? null,
      occurred_at: (r.occurred_at as string | null) ?? null,
    }));

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

    // Ingest order PDFs for genuinely-new order_uploaded events.
    // Best-effort — failures are logged in ingestOrder, never thrown here.
    const newOrders = c.orders.filter((o) =>
      freshHashes.has(`sync:order:${o.order_date}:${o.url ?? ""}`),
    );
    for (const order of newOrders) {
      void ingestOrder({ supabase, lawyerId: lawyer_id, matterId: matter_id }, order);
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
          const update: Record<string, unknown> = { attributes };
          if (h.business_on_date) update.business_on_date = h.business_on_date;
          await supabase.from("tasks").update(update).eq("id", found.id as string);
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
          business_on_date: h.business_on_date ?? null,
          attributes: { purpose: h.purpose, outcome: h.outcome, court_state },
        });
      }
    }
    if (toInsert.length) await supabase.from("tasks").insert(toInsert);
  }

  // Update matter projections. court_status/next_hearing/lifecycle are eCourts-owned
  // and always overwritten. The new fields (judges, advocates, etc.) are also
  // eCourts-owned — overwrite them on every sync so they stay current.
  // The lawyer's matter_status is never touched.
  await supabase
    .from("matters")
    .update({
      court_status: c.court_status ?? matter.court_status,
      next_hearing_date: c.next_hearing_date ?? matter.next_hearing_date,
      lifecycle_state: c.lifecycle_hint,
      last_successful_sync_at: now,
      // eCourts-sourced fields — only overwrite when the API returned them.
      ...(c.filing_date !== null && { filing_date: c.filing_date }),
      ...(c.registration_number !== null && { registration_number: c.registration_number }),
      ...(c.court_code !== null && { court_code: c.court_code }),
      ...(c.court_name !== null && { court_name: c.court_name }),
      ...(c.case_type !== null && { case_type: c.case_type }),
      ...(c.disposal_type !== null && { disposal_type: c.disposal_type }),
      ...(c.judges.length > 0 && { judges: c.judges }),
      ...(c.petitioner_advocates.length > 0 && { petitioner_advocates: c.petitioner_advocates }),
      ...(c.respondent_advocates.length > 0 && { respondent_advocates: c.respondent_advocates }),
      ...(c.tagged_matters.length > 0 && { connected_cnrs: c.tagged_matters }),
      ...(c.state !== null && { state: c.state }),
      ...(c.state_code !== null && { state_code: c.state_code }),
    })
    .eq("id", matter_id);

  return { created, hearings: c.hearings.length, triaged, events };
}

// CNR did not resolve — flag the matter without wiping prior data.
export async function markUnresolved(supabase: DB, matterId: string): Promise<void> {
  await supabase.from("matters").update({ lifecycle_state: "not_found" }).eq("id", matterId);
}
