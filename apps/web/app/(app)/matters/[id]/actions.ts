"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { nextKey } from "@/lib/db";
import { syncOneMatter, type RunResult } from "@/lib/ecourts/run";

// "Sync now" — fetch the matter's CNR from eCourts and diff into its timeline.
export async function syncMatterNow(matterId: string): Promise<RunResult> {
  const { supabase, user } = await authed();
  if (!user) return { ok: false, reason: "unauthorized" };
  const { data: m } = await supabase
    .from("matters")
    .select("id, lawyer_id, cnr, court_status, next_hearing_date")
    .eq("id", matterId)
    .maybeSingle();
  if (!m) return { ok: false, reason: "error" };
  const r = await syncOneMatter(supabase, m as Parameters<typeof syncOneMatter>[1], { react: true });
  revalidatePath(`/matters/${matterId}`);
  return r;
}

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// Next hearing is a projection: the earliest scheduled hearing on/after today.
async function recomputeNextHearing(
  supabase: Awaited<ReturnType<typeof createClient>>,
  matterId: string,
) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("tasks")
    .select("due_date")
    .eq("matter_id", matterId)
    .eq("type", "hearing")
    .eq("attributes->>court_state", "scheduled")
    .gte("due_date", today)
    .order("due_date", { ascending: true })
    .limit(1);
  await supabase
    .from("matters")
    .update({ next_hearing_date: data?.[0]?.due_date ?? null })
    .eq("id", matterId);
}

export async function addRemark(formData: FormData) {
  const matterId = String(formData.get("matter_id"));
  const body = String(formData.get("body") || "").trim();
  if (!matterId || !body) return;
  const { supabase, user } = await authed();
  if (!user) return;
  await supabase.from("activity").insert({
    lawyer_id: user.id,
    matter_id: matterId,
    kind: "remark",
    body,
    source: "lawyer_manual",
    occurred_at: new Date().toISOString(),
  });
  revalidatePath(`/matters/${matterId}`);
}

export async function updateMatter(formData: FormData) {
  const matterId = String(formData.get("matter_id"));
  if (!matterId) return;
  const { supabase, user } = await authed();
  if (!user) return;

  const split = (v: FormDataEntryValue | null) =>
    String(v || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

  await supabase
    .from("matters")
    .update({
      title: String(formData.get("title")),
      case_type: String(formData.get("case_type") || "").trim() || null,
      forum_type: String(formData.get("forum_type") || "district"),
      cnr: String(formData.get("cnr") || "").trim() || null,
      parties: {
        petitioners: split(formData.get("petitioners")),
        respondents: split(formData.get("respondents")),
      },
    })
    .eq("id", matterId);
  revalidatePath(`/matters/${matterId}`);
}

export async function setMatterStatus(matterId: string, status: string) {
  const { supabase, user } = await authed();
  if (!user) return;
  await supabase.from("matters").update({ matter_status: status }).eq("id", matterId);
  revalidatePath(`/matters/${matterId}`);
}

export async function archiveMatter(matterId: string, archived: boolean) {
  const { supabase, user } = await authed();
  if (!user) return;
  await supabase
    .from("matters")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", matterId);
  revalidatePath(`/matters/${matterId}`);
}

export async function createTask(formData: FormData) {
  const matterId = String(formData.get("matter_id"));
  const title = String(formData.get("title") || "").trim();
  if (!matterId || !title) return;
  const { supabase, user } = await authed();
  if (!user) return;

  const { data: todo } = await supabase
    .from("workflow_states")
    .select("id")
    .is("lawyer_id", null)
    .eq("name", "To-Do")
    .single();

  await supabase.from("tasks").insert({
    lawyer_id: user.id,
    matter_id: matterId,
    type: "task",
    key: await nextKey(supabase, "tasks", "T-"),
    title,
    state_id: todo!.id,
    priority: String(formData.get("priority") || "none"),
    due_date: String(formData.get("due_date") || "") || null,
    source: "manual",
  });
  revalidatePath(`/matters/${matterId}`);
}

export async function toggleTask(taskId: string, makeComplete: boolean) {
  const { supabase, user } = await authed();
  if (!user) return;
  const { data: target } = await supabase
    .from("workflow_states")
    .select("id")
    .is("lawyer_id", null)
    .eq("name", makeComplete ? "Done" : "To-Do")
    .single();
  await supabase
    .from("tasks")
    .update({
      state_id: target!.id,
      completed_at: makeComplete ? new Date().toISOString() : null,
    })
    .eq("id", taskId);
  revalidatePath("/", "layout");
}

export async function updateTaskState(taskId: string, stateId: string) {
  const { supabase, user } = await authed();
  if (!user) return;
  const { data: st } = await supabase
    .from("workflow_states")
    .select("type")
    .eq("id", stateId)
    .single();
  const done = st?.type === "completed" || st?.type === "cancelled";
  await supabase
    .from("tasks")
    .update({ state_id: stateId, completed_at: done ? new Date().toISOString() : null })
    .eq("id", taskId);
  revalidatePath("/", "layout");
}

export async function updateTaskPriority(taskId: string, priority: string) {
  const { supabase, user } = await authed();
  if (!user) return;
  await supabase.from("tasks").update({ priority }).eq("id", taskId);
  revalidatePath("/", "layout");
}

// ── Task dependencies (task_relations) ───────────────────────────────────────
// A single canonical row per relation; the inverse direction is computed at read
// time. Relations are scoped to tasks within the same matter (no cross-matter).
export type TaskRelationRow = {
  id: string;
  task_id: string;
  related_id: string;
  kind: "blocks" | "blocked_by" | "related";
};

export async function loadTaskRelations(matterId: string): Promise<TaskRelationRow[]> {
  if (!matterId) return [];
  const { supabase, user } = await authed();
  if (!user) return [];
  // Tasks belonging to this matter (RLS already scopes to the lawyer).
  const { data: tasks } = await supabase.from("tasks").select("id").eq("matter_id", matterId).eq("type", "task");
  const ids = (tasks ?? []).map((t) => t.id);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("task_relations")
    .select("id, task_id, related_id, kind")
    .in("task_id", ids)
    .returns<TaskRelationRow[]>();
  return data ?? [];
}

export async function addTaskRelation(formData: FormData) {
  const matterId = String(formData.get("matter_id"));
  const taskId = String(formData.get("task_id"));
  const relatedId = String(formData.get("related_id"));
  const kind = String(formData.get("kind") || "");
  if (!matterId || !taskId || !relatedId || !kind) return;
  if (taskId === relatedId) return; // a task cannot relate to itself
  if (kind !== "blocks" && kind !== "blocked_by" && kind !== "related") return;
  const { supabase, user } = await authed();
  if (!user) return;

  // Both tasks must live in this matter (no cross-matter linking in this slice).
  const { data: scoped } = await supabase
    .from("tasks")
    .select("id")
    .eq("matter_id", matterId)
    .in("id", [taskId, relatedId]);
  if ((scoped ?? []).length !== 2) return;

  // Prevent duplicate (task_id, related_id, kind).
  const { data: existing } = await supabase
    .from("task_relations")
    .select("id")
    .eq("task_id", taskId)
    .eq("related_id", relatedId)
    .eq("kind", kind)
    .limit(1);
  if ((existing ?? []).length > 0) return;

  await supabase
    .from("task_relations")
    .insert({ lawyer_id: user.id, task_id: taskId, related_id: relatedId, kind });
  revalidatePath(`/matters/${matterId}`);
}

export async function removeTaskRelation(formData: FormData) {
  const matterId = String(formData.get("matter_id"));
  const relationId = String(formData.get("relation_id"));
  if (!relationId) return;
  const { supabase, user } = await authed();
  if (!user) return;
  await supabase.from("task_relations").delete().eq("id", relationId);
  if (matterId) revalidatePath(`/matters/${matterId}`);
}

export async function addHearing(formData: FormData) {
  const matterId = String(formData.get("matter_id"));
  const date = String(formData.get("hearing_date") || "");
  if (!matterId || !date) return;
  const { supabase, user } = await authed();
  if (!user) return;
  await supabase.from("tasks").insert({
    lawyer_id: user.id,
    matter_id: matterId,
    type: "hearing",
    title: String(formData.get("purpose") || "").trim() || "Hearing",
    due_date: date,
    source: "manual",
    attributes: {
      purpose: String(formData.get("purpose") || "").trim() || null,
      court_state: "scheduled",
    },
  });
  await recomputeNextHearing(supabase, matterId);
  revalidatePath(`/matters/${matterId}`);
}

export async function setHearingOutcome(formData: FormData) {
  const hearingId = String(formData.get("hearing_id"));
  const matterId = String(formData.get("matter_id"));
  const state = String(formData.get("state") || "held") as "held" | "adjourned";
  if (!hearingId || !matterId) return;
  const { supabase, user } = await authed();
  if (!user) return;
  // Merge into the hearing task's jsonb attributes (read-then-write).
  const { data: row } = await supabase
    .from("tasks")
    .select("attributes")
    .eq("id", hearingId)
    .maybeSingle();
  const attributes = {
    ...((row?.attributes as Record<string, unknown>) ?? {}),
    court_state: state,
    outcome: String(formData.get("outcome") || "").trim() || null,
  };
  await supabase.from("tasks").update({ attributes }).eq("id", hearingId);
  await recomputeNextHearing(supabase, matterId);
  revalidatePath(`/matters/${matterId}`);
}

export async function uploadDocument(formData: FormData) {
  const matterId = String(formData.get("matter_id"));
  const file = formData.get("file") as File | null;
  if (!matterId || !file || file.size === 0) return;
  const { supabase, user } = await authed();
  if (!user) return;

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${matterId}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("case-documents").upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) return;

  const { error: docError } = await supabase.from("documents").insert({
    lawyer_id: user.id,
    matter_id: matterId,
    name: file.name,
    storage_path: path,
    mime_type: file.type || null,
    size_bytes: file.size,
    source: String(formData.get("source") || "lawyer_upload"),
  });
  // If the row failed, drop the orphaned blob and stop — no timeline entry.
  if (docError) {
    await supabase.storage.from("case-documents").remove([path]);
    return;
  }
  // Surface the upload on the matter timeline. content_hash keys the
  // unique(matter_id, content_hash) constraint — set it to the unique storage path.
  await supabase.from("activity").insert({
    lawyer_id: user.id,
    matter_id: matterId,
    kind: "system",
    event_type: "document_added",
    new_value: file.name,
    source: "system",
    occurred_at: new Date().toISOString(),
    content_hash: `document_added:${path}`,
  });
  revalidatePath(`/matters/${matterId}`);
}

export async function downloadDocument(formData: FormData) {
  const path = String(formData.get("storage_path"));
  if (!path) return;
  const { supabase, user } = await authed();
  if (!user) return;
  const { data } = await supabase.storage.from("case-documents").createSignedUrl(path, 120);
  if (data?.signedUrl) redirect(data.signedUrl);
}

export async function deleteDocument(formData: FormData) {
  const docId = String(formData.get("doc_id"));
  const matterId = String(formData.get("matter_id"));
  const path = String(formData.get("storage_path"));
  if (!docId) return;
  const { supabase, user } = await authed();
  if (!user) return;
  const name = String(formData.get("doc_name") || "").trim();
  // Delete the row first; only touch storage + timeline if it succeeded.
  const { error: delError } = await supabase.from("documents").delete().eq("id", docId);
  if (delError) return;
  if (path) await supabase.storage.from("case-documents").remove([path]);
  await supabase.from("activity").insert({
    lawyer_id: user.id,
    matter_id: matterId,
    kind: "system",
    event_type: "document_removed",
    new_value: name || null,
    source: "system",
    occurred_at: new Date().toISOString(),
    content_hash: `document_removed:${docId}:${Date.now()}`,
  });
  revalidatePath(`/matters/${matterId}`);
}

export async function addDeadline(formData: FormData) {
  const matterId = String(formData.get("matter_id"));
  const date = String(formData.get("due_date") || "");
  if (!matterId || !date) return;
  const { supabase, user } = await authed();
  if (!user) return;
  const deadlineType = String(formData.get("type") || "internal");
  await supabase.from("tasks").insert({
    lawyer_id: user.id,
    matter_id: matterId,
    type: "deadline",
    title: String(formData.get("basis") || "").trim() || `${deadlineType[0].toUpperCase()}${deadlineType.slice(1)} deadline`,
    due_date: date,
    source: "manual",
    attributes: {
      deadline_type: deadlineType,
      basis: String(formData.get("basis") || "").trim() || null,
    },
  });
  revalidatePath(`/matters/${matterId}`);
}
