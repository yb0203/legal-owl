"use client";

import { useState, useTransition } from "react";
import { Tag, Plus, X } from "lucide-react";
import type { Label } from "@/lib/types";
import { LabelChip } from "@/components/label-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  assignLabelToMatter,
  assignLabelToTask,
  createLabel,
  unassignLabelFromMatter,
  unassignLabelFromTask,
} from "@/app/(app)/labels/actions";

// Assign affordance for labels on a task or a matter. Renders the entity's
// current chips inline + a popover that lists the lawyer's labels (toggle to
// assign/unassign) and an inline "create a new label by name" field.
export function LabelPicker({
  kind,
  entityId,
  assigned,
  available,
}: {
  kind: "task" | "matter";
  entityId: string;
  assigned: Label[];
  available: Label[];
}) {
  const [pending, start] = useTransition();
  const [newName, setNewName] = useState("");

  const assignedIds = new Set(assigned.map((l) => l.id));

  const assign = (labelId: string) =>
    start(async () => {
      if (kind === "task") await assignLabelToTask(entityId, labelId);
      else await assignLabelToMatter(entityId, labelId);
    });

  const unassign = (labelId: string) =>
    start(async () => {
      if (kind === "task") await unassignLabelFromTask(entityId, labelId);
      else await unassignLabelFromMatter(entityId, labelId);
    });

  const createAndAssign = () =>
    start(async () => {
      const created = await createLabel(newName);
      if (created) {
        if (kind === "task") await assignLabelToTask(entityId, created.id);
        else await assignLabelToMatter(entityId, created.id);
      }
      setNewName("");
    });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {assigned.map((l) => (
        <LabelChip
          key={l.id}
          label={l}
          onRemove={
            <button
              type="button"
              aria-label={`Remove label ${l.name}`}
              disabled={pending}
              onClick={() => unassign(l.id)}
              className="-mr-0.5 text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              <X className="size-3" />
            </button>
          }
        />
      ))}
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label="Add label"
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Tag className="size-3" aria-hidden />
              {assigned.length === 0 && "Label"}
            </button>
          }
        />
        <PopoverContent align="start" className="w-64">
          <div className="text-xs font-medium text-foreground">Labels</div>
          {available.length === 0 ? (
            <p className="text-xs text-muted-foreground">No labels yet — create one below.</p>
          ) : (
            <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
              {available.map((l) => {
                const on = assignedIds.has(l.id);
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => (on ? unassign(l.id) : assign(l.id))}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-accent disabled:opacity-50"
                    >
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: l.color ?? "var(--muted-foreground)" }}
                      />
                      <span className="min-w-0 flex-1 truncate">{l.name}</span>
                      {on && <span className="shrink-0 text-primary">✓</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <form
            className="flex items-center gap-1.5 border-t pt-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              createAndAssign();
            }}
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New label…"
              className="h-7 text-xs"
            />
            <Button type="submit" size="sm" disabled={pending || !newName.trim()}>
              <Plus className="size-3.5" />
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
