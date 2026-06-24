import type { SupabaseClient } from "@supabase/supabase-js";
import type { Parties, WorkflowState } from "@/lib/types";

/** The shared system workflow states (lawyer_id null), ordered by position. */
export async function getSystemWorkflowStates(
  supabase: SupabaseClient,
): Promise<WorkflowState[]> {
  const { data } = await supabase
    .from("workflow_states")
    .select("id, name, type, position")
    .is("lawyer_id", null)
    .order("position")
    .returns<WorkflowState[]>();
  return data ?? [];
}

// Shared, reusable data helpers. These take the request-scoped (authed) Supabase
// client so RLS applies — they are NOT server actions themselves.

/**
 * Sequential human key like M-7 / T-12, scoped to the lawyer via RLS. For tasks,
 * count only rows that already carry a key (`type='task'` + non-null key) — NOT
 * all type='task' rows. Triage/hearing/deadline rows are type='task' but keyless,
 * and accepting a Triage item mints a key in place (no new row), so counting all
 * task rows would over- or under-count and re-mint an existing T-N, tripping
 * unique(lawyer_id, key). Counting keyed rows keeps the sequence dense.
 */
export async function nextKey(
  supabase: SupabaseClient,
  table: "matters" | "tasks",
  prefix: string,
): Promise<string> {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (table === "tasks") query = query.eq("type", "task").not("key", "is", null);
  const { count } = await query;
  return `${prefix}${(count ?? 0) + 1}`;
}

/**
 * Resolve a system workflow state id by name (lawyer_id null). Used to park
 * synced updates in the fixed 'Triage' state (the Inbox) and to accept/dismiss
 * by moving to 'To-Do' / 'Cancelled'.
 */
export async function getSystemStateId(
  supabase: SupabaseClient,
  name: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("workflow_states")
    .select("id")
    .is("lawyer_id", null)
    .eq("name", name)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(pvt|ltd|llp|co|inc|the|m\/s)\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ConflictMatch {
  matter_id: string;
  matter_title: string;
  matched_name: string;
}

/**
 * Advisory conflict check: does this name already appear as a party on any of
 * the lawyer's existing matters? Normalised, two-way substring match. Never
 * blocks — the caller decides what to do with the matches.
 */
export async function runConflictCheck(
  supabase: SupabaseClient,
  name: string,
): Promise<ConflictMatch[]> {
  const target = normalize(name);
  if (target.length < 3) return [];

  const { data: matters } = await supabase
    .from("matters")
    .select("id, title, parties")
    .returns<{ id: string; title: string; parties: Parties }[]>();

  const matches: ConflictMatch[] = [];
  for (const m of matters ?? []) {
    const parties = [...(m.parties?.petitioners ?? []), ...(m.parties?.respondents ?? [])];
    for (const p of parties) {
      const np = normalize(p);
      if (np.length < 3) continue;
      if (np === target || np.includes(target) || target.includes(np)) {
        matches.push({ matter_id: m.id, matter_title: m.title, matched_name: p });
        break;
      }
    }
  }
  return matches;
}
