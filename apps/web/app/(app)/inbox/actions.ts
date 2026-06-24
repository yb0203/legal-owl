"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { nextKey, getSystemStateId } from "@/lib/db";

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// Inbox items ARE tasks parked in the Triage state. Accept = move to To-Do
// (mint a key if it's still keyless); no new row is created.
export async function acceptTriageItem(formData: FormData) {
  const itemId = String(formData.get("item_id"));
  if (!itemId) return;
  const { supabase, user } = await authed();
  if (!user) return;

  const triageId = await getSystemStateId(supabase, "Triage");
  const { data: item } = await supabase
    .from("tasks")
    .select("id, key, state_id")
    .eq("id", itemId)
    .eq("type", "task")
    .maybeSingle();
  if (!item || item.state_id !== triageId) return;

  const todoId = await getSystemStateId(supabase, "To-Do");
  await supabase
    .from("tasks")
    .update({
      state_id: todoId,
      key: item.key ?? (await nextKey(supabase, "tasks", "T-")),
      priority: String(formData.get("priority") || "medium"),
      due_date: String(formData.get("due_date") || "") || null,
    })
    .eq("id", itemId);
  revalidatePath("/", "layout");
}

// Dismiss = move to the Cancelled state (out of the Inbox, kept for audit).
export async function dismissTriageItem(itemId: string) {
  if (!itemId) return;
  const { supabase, user } = await authed();
  if (!user) return;
  const cancelledId = await getSystemStateId(supabase, "Cancelled");
  const { error } = await supabase
    .from("tasks")
    .update({ state_id: cancelledId, completed_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("type", "task"); // never stamp a state onto a hearing/deadline
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// Snooze hides the item until a chosen time. With no explicit date, defaults to
// the day before the matter's next hearing (or +3 days) — "deal with it just in
// time". A caller-supplied ISO date (Tomorrow / Next week / Custom) overrides.
export async function snoozeTriageItem(itemId: string, untilIso?: string) {
  if (!itemId) return;
  const { supabase, user } = await authed();
  if (!user) return;

  let until: Date;
  if (untilIso) {
    until = new Date(untilIso);
  } else {
    const { data: item } = await supabase
      .from("tasks")
      .select("matter_id")
      .eq("id", itemId)
      .maybeSingle();
    if (!item) return;
    const { data: matter } = await supabase
      .from("matters")
      .select("next_hearing_date")
      .eq("id", item.matter_id)
      .maybeSingle();
    until = new Date();
    if (matter?.next_hearing_date) {
      const dayBefore = new Date(matter.next_hearing_date);
      dayBefore.setDate(dayBefore.getDate() - 1);
      until.setTime(dayBefore.getTime());
    } else {
      until.setDate(until.getDate() + 3);
    }
  }

  // Never write an invalid or past snooze (would crash on toISOString or make
  // the item reappear immediately) — clamp to tomorrow.
  if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
    until = new Date();
    until.setDate(until.getDate() + 1);
  }

  const { error } = await supabase
    .from("tasks")
    .update({ snoozed_until: until.toISOString() })
    .eq("id", itemId)
    .eq("type", "task");
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// Undo a snooze/dismiss: bring the item back into the Triage state, unsnoozed.
export async function reopenTriageItem(itemId: string) {
  if (!itemId) return;
  const { supabase, user } = await authed();
  if (!user) return;
  const triageId = await getSystemStateId(supabase, "Triage");
  const { error } = await supabase
    .from("tasks")
    .update({ state_id: triageId, snoozed_until: null, completed_at: null })
    .eq("id", itemId)
    .eq("type", "task");
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
