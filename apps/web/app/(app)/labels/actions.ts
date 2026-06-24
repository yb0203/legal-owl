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
  // Insert-or-ignore: ignoreDuplicates (ON CONFLICT DO NOTHING) so re-creating a
  // label by an existing name never clobbers its stored color with a null. On
  // conflict the upsert returns no row, so we fetch the existing one (RLS-scoped
  // to this lawyer; unique is (lawyer_id, name)).
  const { data: created } = await supabase
    .from("labels")
    .upsert(
      { lawyer_id: user.id, name: trimmed, color: color ?? null },
      { onConflict: "lawyer_id,name", ignoreDuplicates: true },
    )
    .select("id, name, color")
    .maybeSingle<Label>();
  revalidatePath("/", "layout");
  if (created) return created;
  const { data: existing } = await supabase
    .from("labels")
    .select("id, name, color")
    .eq("name", trimmed)
    .maybeSingle<Label>();
  return existing ?? null;
}

// Confirm a referenced row is owned by the authed lawyer. The select is
// RLS-scoped, so a foreign or non-existent id returns null — closing the
// least-privilege gap where a join row could reference another lawyer's FK target.
async function ownsRow(
  supabase: Awaited<ReturnType<typeof authed>>["supabase"],
  table: "tasks" | "matters" | "labels",
  id: string,
): Promise<boolean> {
  const { data } = await supabase.from(table).select("id").eq("id", id).maybeSingle();
  return Boolean(data);
}

export async function assignLabelToTask(taskId: string, labelId: string) {
  if (!taskId || !labelId) return;
  const { supabase, user } = await authed();
  if (!user) return;
  // Only let a lawyer tag their own task with their own label.
  if (!(await ownsRow(supabase, "tasks", taskId)) || !(await ownsRow(supabase, "labels", labelId))) return;
  // PK (target_type, target_id, label_id) prevents duplicate assignment.
  await supabase
    .from("taggings")
    .upsert(
      { lawyer_id: user.id, target_type: "task", target_id: taskId, label_id: labelId },
      { onConflict: "target_type,target_id,label_id", ignoreDuplicates: true },
    );
  revalidatePath("/", "layout");
}

export async function unassignLabelFromTask(taskId: string, labelId: string) {
  if (!taskId || !labelId) return;
  const { supabase, user } = await authed();
  if (!user) return;
  await supabase
    .from("taggings")
    .delete()
    .eq("target_type", "task")
    .eq("target_id", taskId)
    .eq("label_id", labelId);
  revalidatePath("/", "layout");
}

export async function assignLabelToMatter(matterId: string, labelId: string) {
  if (!matterId || !labelId) return;
  const { supabase, user } = await authed();
  if (!user) return;
  // Only let a lawyer tag their own matter with their own label.
  if (!(await ownsRow(supabase, "matters", matterId)) || !(await ownsRow(supabase, "labels", labelId))) return;
  await supabase
    .from("taggings")
    .upsert(
      { lawyer_id: user.id, target_type: "matter", target_id: matterId, label_id: labelId },
      { onConflict: "target_type,target_id,label_id", ignoreDuplicates: true },
    );
  revalidatePath("/", "layout");
}

export async function unassignLabelFromMatter(matterId: string, labelId: string) {
  if (!matterId || !labelId) return;
  const { supabase, user } = await authed();
  if (!user) return;
  await supabase
    .from("taggings")
    .delete()
    .eq("target_type", "matter")
    .eq("target_id", matterId)
    .eq("label_id", labelId);
  revalidatePath("/", "layout");
}
