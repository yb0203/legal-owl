"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { redirectWithError } from "@/lib/redirect";
import { nextKey, ensureGeneralEngagement } from "@/lib/db";

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
  const engagementId = clientId
    ? await ensureGeneralEngagement(supabase, lawyer_id, clientId)
    : null;

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
      engagement_id: engagementId,
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
    await supabase.from("hearings").insert({
      lawyer_id,
      matter_id: inserted.id,
      hearing_date: firstHearing,
      purpose: "First hearing",
      source: "lawyer_manual",
      state: "scheduled",
    });
  }

  revalidatePath("/matters");
  redirect(`/matters/${inserted!.id}`);
}
