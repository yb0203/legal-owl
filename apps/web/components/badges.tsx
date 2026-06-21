import {
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleSlash,
  Landmark,
  PenLine,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FORUM_LABELS,
  PRIORITY_LABELS,
  STATE_TYPE_LABELS,
  type ActionPriority,
  type EventSource,
  type ForumType,
  type StateType,
} from "@/lib/types";
import { fmtDate, isOverdue, isToday, relativeDay } from "@/lib/format";

// Status by shape-then-color: each state type gets a distinct glyph AND hue, so
// it reads in a glance and survives colour-blindness / sunlight.
const STATE_STYLE: Record<StateType, { icon: typeof Circle; className: string }> = {
  triage: { icon: Inbox, className: "text-lemon" },
  unstarted: { icon: Circle, className: "text-muted-foreground" },
  started: { icon: CircleDot, className: "text-primary" },
  blocked: { icon: CircleSlash, className: "text-urgent" },
  completed: { icon: CircleCheck, className: "text-primary" },
  cancelled: { icon: CircleDashed, className: "text-muted-foreground" },
};

export function StatusBadge({
  type,
  name,
  className,
}: {
  type: StateType;
  name?: string;
  className?: string;
}) {
  const { icon: Icon, className: tone } = STATE_STYLE[type];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", className)}>
      <Icon className={cn("size-3.5 shrink-0", tone)} />
      <span className={type === "completed" || type === "cancelled" ? "text-muted-foreground" : ""}>
        {name ?? STATE_TYPE_LABELS[type]}
      </span>
    </span>
  );
}

const PRIORITY_TONE: Record<ActionPriority, string> = {
  none: "text-muted-foreground",
  low: "text-muted-foreground",
  medium: "text-foreground/70",
  high: "text-urgent",
  urgent: "text-urgent font-semibold",
};

export function PriorityBadge({ priority }: { priority: ActionPriority }) {
  if (priority === "none") return null;
  return (
    <span className={cn("text-xs", PRIORITY_TONE[priority])}>{PRIORITY_LABELS[priority]}</span>
  );
}

// The next-hearing / due date is the highest-signal element: overdue gets a
// solid urgent fill, today gets emphasis, everything else stays calm.
export function DueDateBadge({
  date,
  prefix = "due",
}: {
  date?: string | null;
  prefix?: string;
}) {
  if (!date) return null;
  const overdue = isOverdue(date);
  const today = isToday(date);
  return (
    <span
      className={cn(
        "tnum inline-flex items-center rounded px-1.5 py-0.5 text-xs",
        overdue && "bg-urgent text-white font-medium",
        today && !overdue && "bg-urgent/15 text-urgent font-medium",
        !overdue && !today && "text-muted-foreground",
      )}
    >
      {prefix} {fmtDate(date)}
    </span>
  );
}

export function HearingPill({ date }: { date?: string | null }) {
  if (!date) return <span className="text-sm text-muted-foreground">No date</span>;
  const overdue = isOverdue(date);
  const today = isToday(date);
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="tnum text-base font-semibold">{fmtDate(date)}</span>
      <span
        className={cn(
          "text-xs",
          today ? "font-medium text-urgent" : overdue ? "text-urgent" : "text-muted-foreground",
        )}
      >
        {relativeDay(date)}
      </span>
    </span>
  );
}

export function CNRChip({ cnr }: { cnr?: string | null }) {
  if (!cnr) return null;
  return (
    <span className="tnum rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
      {cnr}
    </span>
  );
}

export function ForumBadge({ forum }: { forum: ForumType }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Landmark className="size-3.5" />
      {FORUM_LABELS[forum]}
    </span>
  );
}

export function SourceChip({ source }: { source: EventSource }) {
  const isCourt = source === "ecourt";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
        isCourt ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {isCourt ? <Landmark className="size-3" /> : <PenLine className="size-3" />}
      {isCourt ? "eCourts" : "You"}
    </span>
  );
}
