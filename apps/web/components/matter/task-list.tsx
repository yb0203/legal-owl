"use client";

import { useTransition } from "react";
import { Circle, CircleCheck, Plus } from "lucide-react";
import { PRIORITIES, PRIORITY_LABELS, type WorkflowState } from "@/lib/types";
import { DueDateBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createTask,
  toggleTask,
  updateTaskPriority,
  updateTaskState,
} from "@/app/(app)/matters/[id]/actions";

export interface TaskRow {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  state_id: string;
  state: { name: string; type: string } | null;
}

const selectCls =
  "h-7 rounded-md border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

export function TaskList({
  matterId,
  tasks,
  states,
}: {
  matterId: string;
  tasks: TaskRow[];
  states: WorkflowState[];
}) {
  const [pending, start] = useTransition();

  return (
    <div className="rounded-xl border bg-card">
      <ul className="divide-y">
        {tasks.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">No tasks yet.</li>
        )}
        {tasks.map((t) => {
          const done = !!t.completed_at;
          return (
            <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <button
                type="button"
                aria-label={done ? "Mark incomplete" : "Mark complete"}
                disabled={pending}
                onClick={() => start(() => toggleTask(t.id, !done))}
                className="shrink-0 disabled:opacity-50"
              >
                {done ? (
                  <CircleCheck className="size-5 text-primary" />
                ) : (
                  <Circle className="size-5 text-muted-foreground hover:text-foreground" />
                )}
              </button>
              <span className={`min-w-0 flex-1 truncate ${done ? "text-muted-foreground line-through" : ""}`}>
                {t.title}
              </span>
              {t.due_date && <DueDateBadge date={t.due_date} />}
              <select
                aria-label="Priority"
                className={selectCls}
                defaultValue={t.priority}
                disabled={pending}
                onChange={(e) => start(() => updateTaskPriority(t.id, e.target.value))}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
              <select
                aria-label="Status"
                className={selectCls}
                defaultValue={t.state_id}
                disabled={pending}
                onChange={(e) => start(() => updateTaskState(t.id, e.target.value))}
              >
                {states.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>

      <form action={createTask} className="flex items-center gap-2 border-t p-2.5">
        <input type="hidden" name="matter_id" value={matterId} />
        <Plus className="size-4 shrink-0 text-muted-foreground" />
        <Input
          name="title"
          required
          placeholder="Add a task…  (e.g. File reply)"
          className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <select name="priority" aria-label="Priority" className={selectCls} defaultValue="none">
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        <Input name="due_date" type="date" aria-label="Due date" className="h-8 w-36" />
        <Button type="submit" size="sm">
          Add
        </Button>
      </form>
    </div>
  );
}
