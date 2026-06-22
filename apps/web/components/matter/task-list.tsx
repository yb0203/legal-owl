"use client";

import { useEffect, useState, useTransition } from "react";
import { Circle, CircleCheck, Link2, Lock, Plus, X } from "lucide-react";
import { PRIORITIES, PRIORITY_LABELS, type ActionPriority, type WorkflowState } from "@/lib/types";
import { DueDateBadge } from "@/components/badges";
import { TaskPriorityMenu, TaskStatusMenu } from "@/components/status-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  addTaskRelation,
  createTask,
  loadTaskRelations,
  removeTaskRelation,
  toggleTask,
  type TaskRelationRow,
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

type RelationKind = "blocks" | "blocked_by" | "related";

const RELATION_KINDS: RelationKind[] = ["blocks", "blocked_by", "related"];
const RELATION_LABELS: Record<RelationKind, string> = {
  blocks: "Blocks",
  blocked_by: "Blocked by",
  related: "Related to",
};
// The relation as seen from the *other* task (incoming rows are displayed inverted).
const INVERSE_KIND: Record<RelationKind, RelationKind> = {
  blocks: "blocked_by",
  blocked_by: "blocks",
  related: "related",
};

const selectCls =
  "h-7 rounded-md border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

// A relation as it applies to one task: the linked task, the kind from this
// task's point of view, and the underlying row id (for removal).
type TaskRelationView = {
  relationId: string;
  kind: RelationKind;
  otherId: string;
};

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
  const [relations, setRelations] = useState<TaskRelationRow[]>([]);

  const addRelation = (actionId: string, relatedId: string, kind: string) => {
    if (!relatedId) return;
    const fd = new FormData();
    fd.set("matter_id", matterId);
    fd.set("action_id", actionId);
    fd.set("related_id", relatedId);
    fd.set("kind", kind);
    start(async () => {
      await addTaskRelation(fd);
      setRelations(await loadTaskRelations(matterId));
    });
  };

  const removeRelation = (relationId: string) => {
    const fd = new FormData();
    fd.set("matter_id", matterId);
    fd.set("relation_id", relationId);
    start(async () => {
      await removeTaskRelation(fd);
      setRelations(await loadTaskRelations(matterId));
    });
  };

  useEffect(() => {
    let active = true;
    loadTaskRelations(matterId).then((r) => {
      if (active) setRelations(r);
    });
    return () => {
      active = false;
    };
  }, [matterId]);

  const titleOf = (id: string) => tasks.find((t) => t.id === id)?.title ?? "Unknown task";

  // All relations that touch a task, normalised to that task's point of view.
  const relationsFor = (taskId: string): TaskRelationView[] => {
    const out: TaskRelationView[] = [];
    for (const r of relations) {
      const kind = r.kind as RelationKind;
      if (r.action_id === taskId) {
        out.push({ relationId: r.id, kind, otherId: r.related_id });
      } else if (r.related_id === taskId) {
        out.push({ relationId: r.id, kind: INVERSE_KIND[kind], otherId: r.action_id });
      }
    }
    return out;
  };

  return (
    <div className="rounded-xl border bg-card">
      <ul className="divide-y">
        {tasks.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">No tasks yet.</li>
        )}
        {tasks.map((t) => {
          const done = !!t.completed_at;
          const rels = relationsFor(t.id);
          const isBlocked = rels.some((r) => r.kind === "blocked_by");
          // Other tasks in this matter, excluding ones already linked, as add candidates.
          const linkedIds = new Set(rels.map((r) => r.otherId));
          const candidates = tasks.filter((c) => c.id !== t.id && !linkedIds.has(c.id));
          return (
            <li key={t.id} className="px-4 py-2.5 text-sm">
              <div className="flex items-center gap-3">
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
                <span
                  className={`min-w-0 flex-1 truncate ${done ? "text-muted-foreground line-through" : ""}`}
                >
                  {t.title}
                </span>
                {isBlocked && (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-destructive/15 px-1.5 py-0.5 text-xs font-medium text-destructive"
                    title="This task is blocked by another task"
                  >
                    <Lock className="size-3" aria-hidden />
                    Blocked
                  </span>
                )}
                {t.due_date && <DueDateBadge date={t.due_date} />}
                <TaskPriorityMenu taskId={t.id} current={t.priority as ActionPriority} />
                <TaskStatusMenu
                  taskId={t.id}
                  states={states}
                  currentStateId={t.state_id}
                  currentType={t.state?.type ?? "unstarted"}
                  currentName={t.state?.name}
                />
                <Popover>
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        aria-label="Manage dependencies"
                        className="relative inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Link2 className="size-4" aria-hidden />
                        {rels.length > 0 && <span className="tnum">{rels.length}</span>}
                      </button>
                    }
                  />
                  <PopoverContent align="end" className="w-80">
                    <div className="text-xs font-medium text-foreground">Dependencies</div>

                    {rels.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No linked tasks yet.</p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {rels.map((r) => (
                          <li
                            key={r.relationId}
                            className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1"
                          >
                            <span className="shrink-0 text-xs font-medium text-muted-foreground">
                              {RELATION_LABELS[r.kind]}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs">
                              {titleOf(r.otherId)}
                            </span>
                            <button
                              type="button"
                              aria-label="Remove dependency"
                              disabled={pending}
                              onClick={() => removeRelation(r.relationId)}
                              className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                            >
                              <X className="size-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {candidates.length > 0 ? (
                      <AddRelationForm
                        candidates={candidates}
                        pending={pending}
                        onAdd={(relatedId, kind) => addRelation(t.id, relatedId, kind)}
                      />
                    ) : (
                      <p className="border-t pt-2.5 text-xs text-muted-foreground">
                        No other tasks in this matter to link.
                      </p>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {rels.length > 0 && (
                <div className="mt-1 ml-8 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {rels.map((r) => (
                    <span key={r.relationId} className="inline-flex items-center gap-1">
                      <span className="font-medium">{RELATION_LABELS[r.kind]}</span>
                      <span className="truncate">{titleOf(r.otherId)}</span>
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <CreateForm matterId={matterId} />
    </div>
  );
}

function AddRelationForm({
  candidates,
  pending,
  onAdd,
}: {
  candidates: TaskRow[];
  pending: boolean;
  onAdd: (relatedId: string, kind: string) => void;
}) {
  const [kind, setKind] = useState<RelationKind>("blocks");
  const [relatedId, setRelatedId] = useState("");
  return (
    <div className="flex flex-col gap-2 border-t pt-2.5">
      <select
        aria-label="Relation kind"
        className={selectCls}
        value={kind}
        onChange={(e) => setKind(e.target.value as RelationKind)}
      >
        {RELATION_KINDS.map((k) => (
          <option key={k} value={k}>
            {RELATION_LABELS[k]}
          </option>
        ))}
      </select>
      <select
        aria-label="Linked task"
        className={selectCls}
        value={relatedId}
        onChange={(e) => setRelatedId(e.target.value)}
      >
        <option value="" disabled>
          Pick a task…
        </option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        disabled={pending || !relatedId}
        onClick={() => {
          onAdd(relatedId, kind);
          setRelatedId("");
        }}
      >
        Link task
      </Button>
    </div>
  );
}

function CreateForm({ matterId }: { matterId: string }) {
  return (
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
  );
}
