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

/**
 * Add a matter by CNR — the only required input.
 * Fetches all case details from eCourts, creates the matter with auto-populated
 * fields (parties, forum, status, next hearing, acts/sections, etc.),
 * backfills hearing history, and fires Court Scout for any agent proposals.
 */
export async function addMatterByCnr(cnr: string): Promise<AddMatterResult> {
  const cnrClean = cnr.trim().toUpperCase();
  if (!cnrClean) return { ok: false, error: "Please enter a CNR." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Prevent duplicates.
  const { data: existing } = await supabase
    .from("matters")
    .select("id")
    .eq("cnr", cnrClean)
    .eq("lawyer_id", user.id)
    .maybeSingle();
  if (existing?.id) return { ok: false, error: "You already have a matter with this CNR." };

  // Fetch from eCourts.
  const res = await getCase(cnrClean);
  if (!res.ok) {
    if (res.reason === "not_found") return { ok: false, error: "CNR not found on eCourts. Check the number and try again." };
    if (res.reason === "rate_limited") return { ok: false, error: "eCourts is rate-limited — wait a moment and retry." };
    if (res.reason === "unauthorized") return { ok: false, error: "eCourts API key not configured." };
    return { ok: false, error: "eCourts lookup failed — check your connection and retry." };
  }

  const enums = await getEnums();
  const c = normalizeCase(res.data, enums);

  // Build a title from parties. e.g. "Sharma vs State of MP"
  const pet = c.petitioners[0] ?? "Petitioner";
  const res_ = c.respondents[0] ?? "Respondent";
  const title = `${pet} vs ${res_}`;

  // Create the matter with all eCourts-sourced fields.
  const { data: matter, error: insertError } = await supabase
    .from("matters")
    .insert({
      lawyer_id: user.id,
      key: await nextKey(supabase, "matters", "M-"),
      title,
      cnr: cnrClean,
      forum_type: c.forum_type ?? "district",
      case_type: c.case_type ?? null,
      court_status: c.court_status ?? null,
      next_hearing_date: c.next_hearing_date ?? null,
      lifecycle_state: c.lifecycle_hint,
      last_successful_sync_at: new Date().toISOString(),
      parties: { petitioners: c.petitioners, respondents: c.respondents },
      // Newly captured fields.
      filing_date: c.filing_date ?? null,
      registration_number: c.registration_number ?? null,
      judges: c.judges.length > 0 ? c.judges : null,
      advocates: c.advocates.length > 0 ? c.advocates : null,
      acts_sections: c.acts_sections.length > 0 ? c.acts_sections : null,
      connected_cnrs: c.connected_cnrs.length > 0 ? c.connected_cnrs : null,
      state: c.state ?? null,
      state_code: c.state_code ?? null,
    })
    .select("id, lawyer_id, cnr, court_status, next_hearing_date")
    .single();

  if (insertError || !matter) {
    return { ok: false, error: insertError?.message ?? "Failed to create matter." };
  }

  // Backfill hearing history and trigger agent reactions.
  // syncMatter handles idempotency so this is safe to run immediately.
  try {
    const summary = await syncMatter(supabase, matter, c);
    await reactToSync(supabase, user.id, matter.id, summary.events);
  } catch {
    // Sync failure is non-fatal — the matter was created with the base data.
  }

  return { ok: true, matterId: matter.id };
}

/**
 * Server action wrapper for the form — redirects on success.
 * Used by the AddMatterByCnr client component.
 */
export async function addMatterAction(formData: FormData): Promise<{ error: string } | never> {
  const cnr = String(formData.get("cnr") ?? "");
  const result = await addMatterByCnr(cnr);
  if (result.ok) redirect(`/matters/${result.matterId}`);
  return { error: result.error };
}
