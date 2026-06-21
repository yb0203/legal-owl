"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function acceptTriageItem(formData: FormData) {
  const itemId = String(formData.get("item_id"));
  if (!itemId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const lawyer_id = user.id;

  const { data: item } = await supabase
    .from("triage_items")
    .select("id, matter_id, summary, state")
    .eq("id", itemId)
    .maybeSingle();
  if (!item || item.state !== "pending") return;

  const { data: todo } = await supabase
    .from("workflow_states")
    .select("id")
    .is("lawyer_id", null)
    .eq("name", "To-Do")
    .single();

  const { data: action } = await supabase
    .from("actions")
    .insert({
      lawyer_id,
      matter_id: item.matter_id,
      key: `ACT-${Date.now().toString(36).toUpperCase()}`,
      title: item.summary,
      state_id: todo!.id,
      source: "triage",
    })
    .select("id")
    .single();

  await supabase
    .from("triage_items")
    .update({ state: "accepted", resulting_action_id: action?.id ?? null })
    .eq("id", itemId);

  revalidatePath("/", "layout");
}

export async function dismissTriageItem(formData: FormData) {
  const itemId = String(formData.get("item_id"));
  if (!itemId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("triage_items").update({ state: "dismissed" }).eq("id", itemId);
  revalidatePath("/", "layout");
}
