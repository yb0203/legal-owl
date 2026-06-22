"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { nextKey } from "@/lib/db";

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
    .from("hearings")
    .select("hearing_date")
    .eq("matter_id", matterId)
    .eq("state", "scheduled")
    .gte("hearing_date", today)
    .order("hearing_date", { ascending: true })
    .limit(1);
  await supabase
    .from("matters")
    .update({ next_hearing_date: data?.[0]?.hearing_date ?? null })
    .eq("id", matterId);
}

export async function addRemark(formData: FormData) {
  const matterId = String(formData.get("matter_id"));
  const body = String(formData.get("body") || "").trim();
  if (!matterId || !body) return;
  const { supabase, user } = await authed();
  if (!user) return;
  await supabase.from("remarks").insert({ lawyer_id: user.id, matter_id: matterId, body });
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

  await supabase.from("actions").insert({
    lawyer_id: user.id,
    matter_id: matterId,
    key: await nextKey(supabase, "actions", "ACT-"),
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
    .from("actions")
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
    .from("actions")
    .update({ state_id: stateId, completed_at: done ? new Date().toISOString() : null })
    .eq("id", taskId);
  revalidatePath("/", "layout");
}

export async function updateTaskPriority(taskId: string, priority: string) {
  const { supabase, user } = await authed();
  if (!user) return;
  await supabase.from("actions").update({ priority }).eq("id", taskId);
  revalidatePath("/", "layout");
}

export async function addHearing(formData: FormData) {
  const matterId = String(formData.get("matter_id"));
  const date = String(formData.get("hearing_date") || "");
  if (!matterId || !date) return;
  const { supabase, user } = await authed();
  if (!user) return;
  await supabase.from("hearings").insert({
    lawyer_id: user.id,
    matter_id: matterId,
    hearing_date: date,
    purpose: String(formData.get("purpose") || "").trim() || null,
    source: "lawyer_manual",
    state: "scheduled",
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
  await supabase
    .from("hearings")
    .update({ state, outcome: String(formData.get("outcome") || "").trim() || null })
    .eq("id", hearingId);
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
  // Surface the upload on the matter timeline. content_hash is NOT NULL with a
  // unique(matter_id, content_hash) constraint — key it to the unique storage path.
  await supabase.from("court_events").insert({
    lawyer_id: user.id,
    matter_id: matterId,
    event_type: "document_added",
    new_value: file.name,
    source_type: "system",
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
  await supabase.from("court_events").insert({
    lawyer_id: user.id,
    matter_id: matterId,
    event_type: "document_removed",
    new_value: name || null,
    source_type: "system",
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
  await supabase.from("deadlines").insert({
    lawyer_id: user.id,
    matter_id: matterId,
    type: String(formData.get("type") || "internal"),
    due_date: date,
    basis: String(formData.get("basis") || "").trim() || null,
  });
  revalidatePath(`/matters/${matterId}`);
}
