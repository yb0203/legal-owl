"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirectWithError } from "@/lib/redirect";
import { ensureGeneralEngagement, runConflictCheck } from "@/lib/db";

export async function createClientRecord(formData: FormData) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const lawyer_id = user.id;

  const display_name = String(formData.get("display_name") || "").trim();
  if (!display_name) redirectWithError("/clients/new", "Name is required");

  const text = (k: string) => String(formData.get(k) || "").trim() || null;

  const { data: inserted, error } = await supabase
    .from("clients")
    .insert({
      lawyer_id,
      display_name,
      type: String(formData.get("type") || "individual"),
      status: String(formData.get("status") || "active"),
      email: text("email"),
      phone: text("phone"),
      address: text("address"),
      gstin: text("gstin"),
      pan: text("pan"),
      notes: text("notes"),
    })
    .select("id")
    .single();

  if (error) redirectWithError("/clients/new", error.message);

  await ensureGeneralEngagement(supabase, lawyer_id, inserted!.id);

  // Advisory conflict check against existing matter parties.
  const matches = await runConflictCheck(supabase, display_name);
  if (matches.length) {
    await supabase.from("conflict_flags").insert(
      matches.map((m) => ({
        lawyer_id,
        client_id: inserted!.id,
        matched_name: m.matched_name,
        matter_id: m.matter_id,
        note: `Matches a party on “${m.matter_title}”`,
      })),
    );
  }

  revalidatePath("/clients");
  redirect(`/clients/${inserted!.id}`);
}
