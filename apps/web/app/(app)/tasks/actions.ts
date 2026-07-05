"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, buildActionContext, register } from "@/lib/actions";
import { nextKey } from "@/lib/db";

// Quick-create a task from the Tasks surface. A task must belong to a matter
// (schema requires matter_id), so the composer makes the matter required.
//
// The mutation itself lives in `createTaskAction` (a typed action via
// `defineAction`) so it is reachable from any transport (Server Action here;
// HTTP / agent-proposal later via the same `execute`). `createQuickTask`
// stays a thin "use server" wrapper: parse FormData, build the request-scoped
// ActionContext, call the typed action, revalidate on success.

const CreateTaskInput = z.object({
  matterId: z.string().min(1),
  title: z.string().trim().min(1),
  priority: z.string().optional(),
  dueDate: z.string().optional(),
});

interface CreateTaskResult {
  key: string;
}

const createTaskAction = defineAction({
  name: "task.create",
  description: "Create a manual task on a matter, parked in the To-Do workflow state.",
  input: CreateTaskInput,
  async run(args, ctx): Promise<CreateTaskResult | null> {
    const { data: todo } = await ctx.supabase
      .from("workflow_states")
      .select("id")
      .is("lawyer_id", null)
      .eq("name", "To-Do")
      .maybeSingle();
    if (!todo) return null;

    const key = await nextKey(ctx.supabase, "tasks", "T-");
    await ctx.supabase.from("tasks").insert({
      lawyer_id: ctx.user.id,
      matter_id: args.matterId,
      type: "task",
      key,
      title: args.title,
      state_id: todo.id,
      priority: args.priority || "none",
      due_date: args.dueDate || null,
      source: "manual",
    });
    return { key };
  },
});

register(createTaskAction);

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
