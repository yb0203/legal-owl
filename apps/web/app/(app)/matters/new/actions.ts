"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { redirectWithError } from "@/lib/redirect";
import { nextKey } from "@/lib/db";
import { syncOneMatter } from "@/lib/ecourts/run";

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

  const { data: inserted, error } = await supabase
    .from("matters")
    .insert({
      lawyer_id,
      key: await nextKey(supabase, "matters", "M-"),
      title: String(formData.get("title")),
      forum_type: String(formData.get("forum_type") || "district"),
      case_type: String(formData.get("case_type") || "").trim() || null,
      cnr: String(formData.get("cnr") || "").trim() || null,
      client_id: clientId,
      parties: {
        petitioners: split(formData.get("petitioners")),
        respondents: split(formData.get("respondents")),
      },
      next_hearing_date: firstHearing,
    })
    .select("id")
    .single();

  if (error) redirectWithError("/matters/new", error.message);

  if (firstHearing && inserted) {
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

  // Connect-by-CNR (U5): if a CNR was given, do a first sync to backfill the
  // timeline + projections (best-effort — never block matter creation on it).
  const cnr = String(formData.get("cnr") || "").trim() || null;
  if (cnr && inserted) {
    await supabase
      .from("matters")
      .update({ lifecycle_state: "pending_first_sync" })
      .eq("id", inserted.id);
    try {
      const { data: m } = await supabase
        .from("matters")
        .select("id, lawyer_id, cnr, court_status, next_hearing_date")
        .eq("id", inserted.id)
        .single();
      if (m) await syncOneMatter(supabase, m as Parameters<typeof syncOneMatter>[1]);
    } catch {
      /* sync is best-effort; the lawyer can retry via Sync now */
    }
  }

  revalidatePath("/matters");
  redirect(`/matters/${inserted!.id}`);
}
