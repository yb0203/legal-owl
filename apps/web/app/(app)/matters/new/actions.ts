"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirectWithError } from "@/lib/redirect";
import { nextKey } from "@/lib/db";
import { syncOneMatter } from "@/lib/ecourts/run";
import { syncMatter } from "@/lib/ecourts/sync";
import { getCase, getEnums } from "@/lib/ecourts/client";
import { normalizeCase } from "@/lib/ecourts/normalize";
import { reactToSync } from "@/lib/agents/react";
import type { NormalizedCase } from "@/lib/ecourts/types";

export type CnrLookupResult =
  | { ok: true; cnr: string; data: NormalizedCase }
  | { ok: false; reason: "not_found" | "rate_limited" | "unauthorized" | "error" };

// Resolve a CNR into case metadata for the "New matter" confirm step (a plain
// server action, not a form action: called from the client lookup component
// via useTransition so it can show a confirm card before anything is created).
// MVP registration is CNR-first only — a lawyer who doesn't have the CNR yet
// falls back to the manual form (see docs/specs/court-monitoring.md for the
// deferred search-by-party/hierarchy-entry paths).
export async function lookupCnr(cnrInput: string): Promise<CnrLookupResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "unauthorized" };
  const cnr = cnrInput.trim();
  if (!cnr) return { ok: false, reason: "error" };
  const res = await getCase(cnr);
  if (!res.ok) return { ok: false, reason: res.reason };
  const enums = await getEnums();
  return { ok: true, cnr, data: normalizeCase(res.data, enums) };
}

export async function createMatter(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const lawyer_id = user.id;

  const split = (v: FormDataEntryValue | null) =>
    String(v || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

  const clientId = String(formData.get("client_id") || "") || null;
  const firstHearing = String(formData.get("first_hearing_date") || "") || null;
  const cnr = String(formData.get("cnr") || "").trim() || null;

  // The CNR-lookup confirm step already fetched + normalized this case (that's
  // what the lawyer confirmed on screen) — reuse it instead of hitting eCourts
  // a second time. Only the manual-entry form (no prior lookup) has no
  // prefetch, so it still needs a fetch when a CNR was typed in by hand.
  let prefetched: NormalizedCase | null = null;
  const prefetchedRaw = String(formData.get("prefetched_case") || "");
  if (prefetchedRaw) {
    try {
      prefetched = JSON.parse(prefetchedRaw) as NormalizedCase;
    } catch {
      /* malformed — fall back to a fresh fetch below */
    }
  }

  const { data: inserted, error } = await supabase
    .from("matters")
    .insert({
      lawyer_id,
      key: await nextKey(supabase, "matters", "M-"),
      title: String(formData.get("title")),
      forum_type: prefetched?.forum_type ?? String(formData.get("forum_type") || "district"),
      case_type: prefetched?.case_type ?? (String(formData.get("case_type") || "").trim() || null),
      cnr,
      client_id: clientId,
      parties: {
        petitioners: prefetched?.petitioners ?? split(formData.get("petitioners")),
        respondents: prefetched?.respondents ?? split(formData.get("respondents")),
      },
      next_hearing_date: prefetched?.next_hearing_date ?? firstHearing,
      court_hierarchy: prefetched?.court_code ? { code: prefetched.court_code } : null,
    })
    .select("id")
    .single();

  if (error) redirectWithError("/matters/new", error.message);

  if (firstHearing && !prefetched && inserted) {
    await supabase.from("tasks").insert({
      lawyer_id,
      matter_id: inserted.id,
      type: "hearing",
      title: "First hearing",
      due_date: firstHearing,
      source: "manual",
      attributes: { purpose: "First hearing", court_state: "scheduled" },
    });
  }

  if (cnr && inserted) {
    if (prefetched) {
      // Already fetched + confirmed — write the timeline/hearing tasks/status
      // from that data (local DB writes only, no further eCourts call), then
      // defer the agent reaction (an LLM call) so it never blocks the redirect.
      const summary = await syncMatter(
        supabase,
        { id: inserted.id, lawyer_id, court_status: null, next_hearing_date: null },
        prefetched,
      );
      after(() => reactToSync(supabase, lawyer_id, inserted.id, summary.events));
    } else {
      // Manual-entry path with a hand-typed CNR — no prior lookup to reuse.
      // Defer the whole fetch + sync so matter creation never blocks on
      // eCourts; the matter shows "Pending first sync" until it completes.
      await supabase.from("matters").update({ lifecycle_state: "pending_first_sync" }).eq("id", inserted.id);
      after(async () => {
        try {
          const { data: m } = await supabase
            .from("matters")
            .select("id, lawyer_id, cnr, court_status, next_hearing_date")
            .eq("id", inserted.id)
            .single();
          if (m) await syncOneMatter(supabase, m as Parameters<typeof syncOneMatter>[1], { react: true });
        } catch {
          /* sync is best-effort; the lawyer can retry via Sync now */
        }
      });
    }
  }

  revalidatePath("/matters");
  redirect(`/matters/${inserted!.id}`);
}
