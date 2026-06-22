"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Circle, CircleCheck } from "lucide-react";
import { type ActionPriority, type Label, type WorkflowState } from "@/lib/types";
import { DueDateBadge } from "@/components/badges";
import { LabelChip } from "@/components/label-chip";
import { TaskPriorityMenu, TaskStatusMenu } from "@/components/status-control";
import { toggleTask } from "@/app/(app)/matters/[id]/actions";

export interface CrossTask {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  state_id: string;
  state: { name: string; type: string } | null;
  matter: { id: string; title: string } | null;
  labels?: Label[];
}

// A single task row — reused by the flat list and by the grouped (time-horizon) view.
export function TaskRow({ task: t, states }: { task: CrossTask; states: WorkflowState[] }) {
  const [pending, start] = useTransition();
  const done = !!t.completed_at;
  return (
    <li className="flex items-center gap-3 bg-card px-4 py-2.5 text-sm">
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
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {t.matter && (
            <Link
              href={`/matters/${t.matter.id}`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t.matter.title}
            </Link>
          )}
          {(t.labels?.length ?? 0) > 0 &&
            t.labels!.map((l) => <LabelChip key={l.id} label={l} />)}
        </div>
      </div>
      {t.due_date && <DueDateBadge date={t.due_date} />}
      <TaskPriorityMenu taskId={t.id} current={t.priority as ActionPriority} />
      <TaskStatusMenu
        taskId={t.id}
        states={states}
        currentStateId={t.state_id}
        currentType={t.state?.type ?? "unstarted"}
        currentName={t.state?.name}
      />
    </li>
  );
}

export function TasksList({ tasks, states }: { tasks: CrossTask[]; states: WorkflowState[] }) {
  if (tasks.length === 0) return null;
  return (
    <ul className="divide-y overflow-hidden rounded-xl border">
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} states={states} />
      ))}
    </ul>
  );
}
