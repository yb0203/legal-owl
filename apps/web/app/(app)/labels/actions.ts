"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Label } from "@/lib/types";

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// All of a lawyer's labels — used to populate the assign affordances.
export async function loadLabels(): Promise<Label[]> {
  const { supabase, user } = await authed();
  if (!user) return [];
  const { data } = await supabase
    .from("labels")
    .select("id, name, color")
    .order("name", { ascending: true })
    .returns<Label[]>();
  return data ?? [];
}

// Create a label (idempotent on name per lawyer) and return it. Powers the
// "create-on-assign" inline affordance.
export async function createLabel(name: string, color?: string): Promise<Label | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { supabase, user } = await authed();
  if (!user) return null;
  const { data } = await supabase
    .from("labels")
    .upsert(
      { lawyer_id: user.id, name: trimmed, color: color ?? null },
      { onConflict: "lawyer_id,name", ignoreDuplicates: false },
    )
    .select("id, name, color")
    .single<Label>();
  revalidatePath("/", "layout");
  return data ?? null;
}

export async function assignLabelToTask(actionId: string, labelId: string) {
  if (!actionId || !labelId) return;
  const { supabase, user } = await authed();
  if (!user) return;
  // Unique (action_id, label_id) PK prevents duplicate assignment.
  await supabase
    .from("action_labels")
    .upsert({ lawyer_id: user.id, action_id: actionId, label_id: labelId }, { onConflict: "action_id,label_id", ignoreDuplicates: true });
  revalidatePath("/", "layout");
}

export async function unassignLabelFromTask(actionId: string, labelId: string) {
  if (!actionId || !labelId) return;
  const { supabase, user } = await authed();
  if (!user) return;
  await supabase
    .from("action_labels")
    .delete()
    .eq("action_id", actionId)
    .eq("label_id", labelId);
  revalidatePath("/", "layout");
}

export async function assignLabelToMatter(matterId: string, labelId: string) {
  if (!matterId || !labelId) return;
  const { supabase, user } = await authed();
  if (!user) return;
  // Unique (matter_id, label_id) PK prevents duplicate assignment.
  await supabase
    .from("matter_labels")
    .upsert({ lawyer_id: user.id, matter_id: matterId, label_id: labelId }, { onConflict: "matter_id,label_id", ignoreDuplicates: true });
  revalidatePath("/", "layout");
}

export async function unassignLabelFromMatter(matterId: string, labelId: string) {
  if (!matterId || !labelId) return;
  const { supabase, user } = await authed();
  if (!user) return;
  await supabase
    .from("matter_labels")
    .delete()
    .eq("matter_id", matterId)
    .eq("label_id", labelId);
  revalidatePath("/", "layout");
}
