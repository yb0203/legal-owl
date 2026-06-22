"use client";

import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  type ActionPriority,
  type StateType,
  type WorkflowState,
} from "@/lib/types";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateTaskPriority, updateTaskState } from "@/app/(app)/matters/[id]/actions";
import { cn } from "@/lib/utils";

const triggerCls =
  "inline-flex h-7 items-center gap-1 rounded-md border border-input bg-transparent px-1.5 text-xs outline-none transition-colors hover:bg-accent/40 disabled:opacity-50";

// Status menu: the trigger shows the current StatusBadge; each option is a badge.
export function TaskStatusMenu({
  taskId,
  states,
  currentStateId,
  currentType,
  currentName,
}: {
  taskId: string;
  states: WorkflowState[];
  currentStateId: string;
  currentType: string;
  currentName?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<button type="button" className={triggerCls} disabled={pending} />}
      >
        <StatusBadge type={currentType as StateType} name={currentName} />
        <ChevronDown className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {states.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onClick={() => start(() => updateTaskState(taskId, s.id))}
            className={cn(s.id === currentStateId && "bg-accent/40")}
          >
            <StatusBadge type={s.type} name={s.name} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Priority menu: trigger shows the current priority (or "Priority" when none).
export function TaskPriorityMenu({
  taskId,
  current,
}: {
  taskId: string;
  current: ActionPriority;
}) {
  const [pending, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<button type="button" className={triggerCls} disabled={pending} />}
      >
        {current === "none" ? (
          <span className="text-muted-foreground">Priority</span>
        ) : (
          <PriorityBadge priority={current} />
        )}
        <ChevronDown className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {PRIORITIES.map((p) => (
          <DropdownMenuItem
            key={p}
            onClick={() => start(() => updateTaskPriority(taskId, p))}
            className={cn(p === current && "bg-accent/40")}
          >
            {p === "none" ? (
              <span className="text-muted-foreground">{PRIORITY_LABELS[p]}</span>
            ) : (
              <PriorityBadge priority={p} />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
