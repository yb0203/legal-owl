import type { SupabaseClient } from "@supabase/supabase-js";
import type { Parties } from "@/lib/types";

// Shared, reusable data helpers. These take the request-scoped (authed) Supabase
// client so RLS applies — they are NOT server actions themselves.

/** Sequential human key like M-7 / ACT-12, scoped to the lawyer via RLS. */
export async function nextKey(
  supabase: SupabaseClient,
  table: "matters" | "actions",
  prefix: string,
): Promise<string> {
  const { count } = await supabase.from(table).select("id", { count: "exact", head: true });
  return `${prefix}${(count ?? 0) + 1}`;
}

/** Every client gets a default "General" engagement; create it if missing. */
export async function ensureGeneralEngagement(
  supabase: SupabaseClient,
  lawyerId: string,
  clientId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("engagements")
    .select("id")
    .eq("client_id", clientId)
    .eq("name", "General")
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data } = await supabase
    .from("engagements")
    .insert({ lawyer_id: lawyerId, client_id: clientId, name: "General" })
    .select("id")
    .single();
  return data!.id as string;
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
