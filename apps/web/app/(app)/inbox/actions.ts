"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { nextKey } from "@/lib/db";

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function acceptTriageItem(formData: FormData) {
  const itemId = String(formData.get("item_id"));
  if (!itemId) return;
  const { supabase, user } = await authed();
  if (!user) return;

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
      lawyer_id: user.id,
      matter_id: item.matter_id,
      key: await nextKey(supabase, "actions", "ACT-"),
      title: item.summary,
      state_id: todo!.id,
      priority: String(formData.get("priority") || "medium"),
      due_date: String(formData.get("due_date") || "") || null,
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

export async function dismissTriageItem(itemId: string) {
  if (!itemId) return;
  const { supabase, user } = await authed();
  if (!user) return;
  await supabase.from("triage_items").update({ state: "dismissed" }).eq("id", itemId);
  revalidatePath("/", "layout");
}

// Snooze hides the item until the day before the matter's next hearing (or a
// few days out if there's none) — the persona's "deal with it just in time".
export async function snoozeTriageItem(itemId: string) {
  if (!itemId) return;
  const { supabase, user } = await authed();
  if (!user) return;

  const { data: item } = await supabase
    .from("triage_items")
    .select("matter_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return;

  const { data: matter } = await supabase
    .from("matters")
    .select("next_hearing_date")
    .eq("id", item.matter_id)
    .maybeSingle();

  const until = new Date();
  if (matter?.next_hearing_date) {
    const dayBefore = new Date(matter.next_hearing_date);
    dayBefore.setDate(dayBefore.getDate() - 1);
    until.setTime(dayBefore.getTime());
  } else {
    until.setDate(until.getDate() + 3);
  }

  await supabase.from("triage_items").update({ snoozed_until: until.toISOString() }).eq("id", itemId);
  revalidatePath("/", "layout");
}
