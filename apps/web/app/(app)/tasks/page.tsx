import Link from "next/link";
import { ListTodo, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSystemWorkflowStates } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/page-header";
import { PageShell, Panel, SectionHeading } from "@/components/layout";
import { NativeSelect } from "@/components/native-select";
import { TasksList, TaskRow, type CrossTask } from "@/components/tasks-list";
import { TimeGroups, groupByTimeHorizon } from "@/components/time-groups";
import { HelpLink } from "@/components/help/help-link";
import { PRIORITIES, PRIORITY_LABELS, type Label } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createQuickTask } from "./actions";

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "overdue", label: "Overdue" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" },
] as const;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; label?: string }>;
}) {
  const { filter = "open", label = "" } = await searchParams;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: rows }, states, { data: matters }, { data: labelRows }, { data: assignmentRows }] = await Promise.all([
    supabase
      .from("actions")
      .select(
        "id, title, priority, due_date, completed_at, state_id, state:workflow_states(name, type), matter:matters(id, title)",
      )
      .order("due_date", { ascending: true, nullsFirst: false })
      .returns<CrossTask[]>(),
    getSystemWorkflowStates(supabase),
    supabase
      .from("matters")
      .select("id, title")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .returns<{ id: string; title: string }[]>(),
    supabase.from("labels").select("id, name, color").order("name").returns<Label[]>(),
    supabase.from("action_labels").select("action_id, label_id").returns<{ action_id: string; label_id: string }[]>(),
  ]);

  const labels = labelRows ?? [];
  const labelById = new Map(labels.map((l) => [l.id, l]));
  const labelsByTask: Record<string, Label[]> = {};
  for (const a of assignmentRows ?? []) {
    const l = labelById.get(a.label_id);
    if (l) (labelsByTask[a.action_id] ??= []).push(l);
  }
  const all = (rows ?? []).map((t) => ({ ...t, labels: labelsByTask[t.id] ?? [] }));
  const isDone = (t: CrossTask) => !!t.completed_at;
  const open = all.filter((t) => !isDone(t));
  const counts = {
    open: open.length,
    overdue: open.filter((t) => t.due_date && t.due_date < today).length,
    done: all.filter(isDone).length,
    all: all.length,
  };

  let tasks = all;
  if (filter === "open") tasks = open;
  else if (filter === "done") tasks = all.filter(isDone);
  else if (filter === "overdue")
    tasks = all.filter((t) => !isDone(t) && t.due_date && t.due_date < today);
  if (label) tasks = tasks.filter((t) => t.labels.some((l) => l.id === label));

  // The default Open view groups by time-horizon; other views stay flat.
  const grouped = filter === "open";
  const { groups, undated } = grouped
    ? groupByTimeHorizon(tasks, (t) => t.due_date)
    : { groups: [], undated: [] };
  const matterOptions = matters ?? [];

  return (
    <PageShell>
      <PageHeader title="Tasks" subtitle="Everything you need to do across your matters.">
        <HelpLink anchor="tasks" label="Tasks" />
      </PageHeader>

      {/* Quick-create — a task always belongs to a matter. */}
      {matterOptions.length > 0 && (
        <Panel
          as="form"
          action={createQuickTask}
          className="mb-4 flex flex-wrap items-center gap-2 p-2.5"
        >
          <Plus className="size-4 shrink-0 text-muted-foreground" />
          <Input
            name="title"
            required
            placeholder="Add a task…"
            className="h-9 min-w-40 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <NativeSelect
            name="matter_id"
            required
            aria-label="Matter"
            defaultValue=""
            className="w-auto rounded-md px-2"
          >
            <option value="" disabled>
              Matter…
            </option>
            {matterOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            name="priority"
            aria-label="Priority"
            defaultValue="none"
            className="w-auto rounded-md px-2"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </NativeSelect>
          <Input name="due_date" type="date" aria-label="Due date" className="h-9 w-36" />
          <Button type="submit" size="sm">
            Add
          </Button>
        </Panel>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          const sp = new URLSearchParams({
            ...(f.value !== "open" ? { filter: f.value } : {}),
            ...(label ? { label } : {}),
          });
          const href = sp.toString() ? `/tasks?${sp}` : "/tasks";
          return (
            <Link
              key={f.value}
              href={href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent/40",
              )}
            >
              {f.label}
              <span className={cn("tnum", active ? "text-foreground/70" : "text-muted-foreground/70")}>
                {counts[f.value]}
              </span>
            </Link>
          );
        })}
      </div>

      {labels.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {labels.map((l) => {
            const active = label === l.id;
            const sp = new URLSearchParams({
              ...(filter !== "open" ? { filter } : {}),
              ...(active ? {} : { label: l.id }),
            });
            return (
              <Link
                key={l.id}
                href={sp.toString() ? `/tasks?${sp}` : "/tasks"}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  active ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent/40",
                )}
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: l.color ?? "var(--muted-foreground)" }} />
                {l.name}
              </Link>
            );
          })}
        </div>
      )}

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title={label ? "No tasks with this label" : filter === "overdue" ? "Nothing overdue" : "No tasks here"}
          description={
            label
              ? "No tasks in this view carry the selected label — clear the label filter to see the rest."
              : filter === "overdue"
                ? "You're on top of your deadlines — nothing is past due."
                : "Add one above, create a task on a matter, or accept an item from the Inbox."
          }
          action={
            matterOptions.length === 0 ? (
              <Link href="/matters/new" className={buttonVariants({ size: "sm" })}>
                + New matter
              </Link>
            ) : undefined
          }
        />
      ) : grouped ? (
        <div className="space-y-6">
          <TimeGroups groups={groups} renderRow={(t) => <TaskRow task={t} states={states} />} rowKey={(t) => t.id} />
          {undated.length > 0 && (
            <section>
              <SectionHeading variant="serif" className="mb-2">
                No date
              </SectionHeading>
              <TasksList tasks={undated} states={states} />
            </section>
          )}
        </div>
      ) : (
        <TasksList tasks={tasks} states={states} />
      )}
    </PageShell>
  );
}
