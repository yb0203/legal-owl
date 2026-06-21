import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/page-header";
import { TasksList, type CrossTask } from "@/components/tasks-list";
import { type WorkflowState } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "overdue", label: "Overdue" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" },
] as const;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "open" } = await searchParams;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: rows } = await supabase
    .from("actions")
    .select(
      "id, title, priority, due_date, completed_at, state_id, state:workflow_states(name, type), matter:matters(id, title)",
    )
    .order("due_date", { ascending: true, nullsFirst: false })
    .returns<CrossTask[]>();

  const all = rows ?? [];
  const isDone = (t: CrossTask) => !!t.completed_at;

  let tasks = all;
  if (filter === "open") tasks = all.filter((t) => !isDone(t));
  else if (filter === "done") tasks = all.filter(isDone);
  else if (filter === "overdue")
    tasks = all.filter((t) => !isDone(t) && t.due_date && t.due_date < today);

  const { data: states } = await supabase
    .from("workflow_states")
    .select("id, name, type, position")
    .is("lawyer_id", null)
    .order("position")
    .returns<WorkflowState[]>();

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <PageHeader title="Tasks" subtitle="Everything you need to do across your matters." />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <Link
              key={f.value}
              href={f.value === "open" ? "/tasks" : `/tasks?filter=${f.value}`}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent/40",
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title={filter === "overdue" ? "Nothing overdue" : "No tasks here"}
          hint="Tasks you create on a matter, or accept from the Inbox, show up here."
        />
      ) : (
        <TasksList tasks={tasks} states={states ?? []} />
      )}
    </main>
  );
}
