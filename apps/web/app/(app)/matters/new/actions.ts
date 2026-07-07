"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { nextKey } from "@/lib/db";
import { getCase, getEnums } from "@/lib/ecourts/client";
import { normalizeCase } from "@/lib/ecourts/normalize";
import { syncMatter } from "@/lib/ecourts/sync";
import { reactToSync } from "@/lib/agents/react";

export type AddMatterResult =
  | { ok: true; matterId: string }
  | { ok: false; error: string };

export async function addMatterByCnr(cnr: string): Promise<AddMatterResult> {
  const cnrClean = cnr.trim().toUpperCase().replace(/[-\s]/g, "");
  if (!cnrClean) return { ok: false, error: "Please enter a CNR." };
  if (cnrClean.length < 10)
    return {
      ok: false,
      error: `"${cnr}" doesn't look like a valid CNR. It should be 16 characters, e.g. UPHC020231392025.`,
    };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // If the matter already exists, go straight to it.
  const { data: existing } = await supabase
    .from("matters")
    .select("id")
    .eq("cnr", cnrClean)
    .eq("lawyer_id", user.id)
    .maybeSingle();
  if (existing?.id) return { ok: true, matterId: existing.id as string };

  // Fetch from eCourts.
  const res = await getCase(cnrClean);
  if (!res.ok) {
    if (res.reason === "not_found")
      return { ok: false, error: `CNR "${cnrClean}" was not found on eCourts. Double-check the number and try again.` };
    if (res.reason === "rate_limited")
      return { ok: false, error: "eCourts is rate-limited right now — wait a few seconds and retry." };
    if (res.reason === "unauthorized")
      return { ok: false, error: "eCourts API key (ECOURTS_API_KEY) is not configured. Add it to apps/web/.env.local." };
    return { ok: false, error: "eCourts lookup failed — check the server terminal for details." };
  }

  const enums = await getEnums();
  const c = normalizeCase(res.data, enums);

  const pet = c.petitioners[0] ?? "Petitioner";
  const resp = c.respondents[0] ?? "Respondent";
  const title = `${pet} vs ${resp}`;

  // Insert the matter WITHOUT court_status / next_hearing_date so that
  // syncMatter below sees a full diff and generates the complete activity
  // timeline (status_changed, hearing_date_changed, order_uploaded events)
  // and inserts every hearing from the API history as a task.
  const { data: matter, error: insertError } = await supabase
    .from("matters")
    .insert({
      lawyer_id: user.id,
      key: await nextKey(supabase, "matters", "M-"),
      title,
      cnr: cnrClean,
      forum_type: c.forum_type ?? "district",
      case_type: c.case_type ?? null,
      // court_status and next_hearing_date intentionally omitted —
      // syncMatter will diff from null and write them with proper activity rows.
      lifecycle_state: "pending_first_sync",
      parties: {
        petitioners: c.petitioners,
        respondents: c.respondents,
      },
      // Static eCourts identity fields (not sync projections).
      filing_date: c.filing_date ?? null,
      registration_number: c.registration_number ?? null,
      court_code: c.court_code ?? null,
      court_name: c.court_name ?? null,
      disposal_type: c.disposal_type ?? null,
      judges: c.judges.length > 0 ? c.judges : null,
      petitioner_advocates: c.petitioner_advocates.length > 0 ? c.petitioner_advocates : null,
      respondent_advocates: c.respondent_advocates.length > 0 ? c.respondent_advocates : null,
      connected_cnrs: c.tagged_matters.length > 0 ? c.tagged_matters : null,
      state: c.state ?? null,
      state_code: c.state_code ?? null,
    })
    .select("id, lawyer_id, cnr, court_status, next_hearing_date")
    .single();

  if (insertError || !matter) {
    return { ok: false, error: insertError?.message ?? "Failed to create matter." };
  }

  // syncMatter: diff from (null, null) → generates full activity timeline
  // and inserts all hearings from the API history as tasks.
  // Errors are logged but non-fatal — the matter exists and the lawyer
  // can press Sync now to retry.
  try {
    const summary = await syncMatter(supabase, matter, c);
    await reactToSync(supabase, user.id, matter.id, summary.events);
  } catch (err) {
    console.error("[addMatterByCnr] syncMatter failed:", err);
  }

  return { ok: true, matterId: matter.id };
}

export async function addMatterAction(formData: FormData): Promise<{ error: string } | never> {
  const cnr = String(formData.get("cnr") ?? "");
  const result = await addMatterByCnr(cnr);
  if (result.ok) redirect(`/matters/${result.matterId}`);
  return { error: result.error };
}
