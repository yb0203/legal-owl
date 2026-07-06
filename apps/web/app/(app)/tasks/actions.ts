"use server";

import { revalidatePath } from "next/cache";
import { buildActionContext } from "@/lib/actions";
import { createTaskAction } from "@/lib/actions/task-create";

// Quick-create a task from the Tasks surface. The mutation lives in the shared
// `createTaskAction` typed action (lib/actions/task-create) so it is reachable
// from any transport (this Server Action, HTTP, or an agent proposal via the
// Inbox accept path). `createQuickTask` stays a thin "use server" wrapper: parse
// FormData, build the request-scoped ActionContext, call execute, revalidate.

export async function createQuickTask(formData: FormData) {
  const matterId = String(formData.get("matter_id") || "");
  const title = String(formData.get("title") || "").trim();
  if (!matterId || !title) return;

  const ctx = await buildActionContext("server-action");
  if (!ctx) return;

  const result = await createTaskAction.execute(
    {
      matterId,
      title,
      priority: String(formData.get("priority") || ""),
      dueDate: String(formData.get("due_date") || ""),
    },
    ctx,
  );

  if (result.ok && result.data) revalidatePath("/", "layout");
}
