"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Circle, CircleCheck } from "lucide-react";
import { PRIORITIES, PRIORITY_LABELS, type WorkflowState } from "@/lib/types";
import { DueDateBadge } from "@/components/badges";
import {
  toggleTask,
  updateTaskPriority,
  updateTaskState,
} from "@/app/(app)/matters/[id]/actions";

export interface CrossTask {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  state_id: string;
  state: { name: string; type: string } | null;
  matter: { id: string; title: string } | null;
}

const selectCls =
  "h-7 rounded-md border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

export function TasksList({ tasks, states }: { tasks: CrossTask[]; states: WorkflowState[] }) {
  const [pending, start] = useTransition();

  if (tasks.length === 0) return null;

  return (
    <ul className="divide-y overflow-hidden rounded-xl border">
      {tasks.map((t) => {
        const done = !!t.completed_at;
        return (
          <li key={t.id} className="flex items-center gap-3 bg-card px-4 py-2.5 text-sm">
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
            <div className="min-w-0 flex-1">
              <div className={done ? "truncate text-muted-foreground line-through" : "truncate"}>
                {t.title}
              </div>
              {t.matter && (
                <Link
                  href={`/matters/${t.matter.id}`}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t.matter.title}
                </Link>
              )}
            </div>
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
  );
}
