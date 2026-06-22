// Shared date/number formatting. Dates render dd-MMM (e.g. 24-Jun) to kill the
// dd/mm vs mm/dd ambiguity, per the design language.

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function fmtDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d)
    .toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
    .replace(/\s+/, "-");
}

export function fmtDateYear(d?: string | null): string {
  if (!d) return "—";
  const s = new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  // "24 Jun 2026" -> "24-Jun-2026"
  return s.replace(/\s+/g, "-").replace(/,/g, "");
}

export function fmtDateLong(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Whole-day difference from today (negative = past). */
export function daysUntil(d: string): number {
  const target = startOfDay(new Date(d)).getTime();
  const today = startOfDay(new Date()).getTime();
  return Math.round((target - today) / 86_400_000);
}

export function isOverdue(d?: string | null): boolean {
  return !!d && daysUntil(d) < 0;
}

export function isToday(d?: string | null): boolean {
  return !!d && daysUntil(d) === 0;
}

/** "this week" = due in the next 1–7 days (not today, not overdue). */
export function isThisWeek(d?: string | null): boolean {
  const n = d ? daysUntil(d) : NaN;
  return Number.isFinite(n) && n >= 1 && n <= 7;
}

/** "Today" | "Tomorrow" | "in 3 days" | "5 days ago". */
export function relativeDay(d?: string | null): string {
  if (!d) return "";
  const n = daysUntil(d);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

// ── Time-horizon bucketing ───────────────────────────────────────────────────
// One shared way to group obligations the way a lawyer thinks about the day:
// Overdue (loudest) → Today → This week → Later. Used by every list surface so
// urgency reads identically everywhere.
export type TimeBucket = "overdue" | "today" | "week" | "later";

export const TIME_BUCKET_ORDER: readonly TimeBucket[] = [
  "overdue",
  "today",
  "week",
  "later",
] as const;

export const TIME_BUCKET_LABELS: Record<TimeBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "This week",
  later: "Later",
};

/** Bucket a date into the shared time-horizon. Returns null for no date. */
export function timeBucket(d?: string | null): TimeBucket | null {
  if (!d) return null;
  const n = daysUntil(d);
  if (n < 0) return "overdue";
  if (n === 0) return "today";
  if (n <= 7) return "week";
  return "later";
}
