import { z } from "zod";
import { defineAction, register } from "@/lib/actions";
import { nextKey } from "@/lib/db";

// task.create as a standalone typed action in a PLAIN module (not "use server"),
// so its register() runs in any importing runtime — including the Inbox accept
// path that executes agent proposals. (A "use server" module's top-level
// register() does not reliably run there.) Mirrors lib/actions/fact-create.ts.

const CreateTaskInput = z.object({
  matterId: z.string().min(1),
  title: z.string().trim().min(1),
  priority: z.string().optional(),
  dueDate: z.string().optional(),
});

interface CreateTaskResult {
  key: string;
}

export const createTaskAction = defineAction({
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
      // Agent-proposal accepts run with source 'agent-proposal'; tag those tasks
      // 'agent', leaving the Tasks quick-composer's tasks 'manual'.
      source: ctx.source === "agent-proposal" ? "agent" : "manual",
    });
    return { key };
  },
});

register(createTaskAction);
