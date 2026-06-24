"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { nextKey } from "@/lib/db";

// Quick-create a task from the Tasks surface. A task must belong to a matter
// (schema requires matter_id), so the composer makes the matter required.
export async function createQuickTask(formData: FormData) {
  const matterId = String(formData.get("matter_id") || "");
  const title = String(formData.get("title") || "").trim();
  if (!matterId || !title) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: todo } = await supabase
    .from("workflow_states")
    .select("id")
    .is("lawyer_id", null)
    .eq("name", "To-Do")
    .maybeSingle();
  if (!todo) return;

  await supabase.from("tasks").insert({
    lawyer_id: user.id,
    matter_id: matterId,
    type: "task",
    key: await nextKey(supabase, "tasks", "T-"),
    title,
    state_id: todo.id,
    priority: String(formData.get("priority") || "none"),
    due_date: String(formData.get("due_date") || "") || null,
    source: "manual",
  });
  revalidatePath("/", "layout");
}
