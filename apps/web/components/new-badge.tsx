import { cn } from "@/lib/utils";

// A small "New" pill for items that arrived recently (e.g. freshly synced court
// updates). Recency-based so it needs no per-user seen-state: shows for items
// created within `withinHours` (default 24h).
export function NewBadge({
  createdAt,
  withinHours = 24,
  className,
}: {
  createdAt?: string | null;
  withinHours?: number;
  className?: string;
}) {
  if (!createdAt) return null;
  const age = Date.now() - new Date(createdAt).getTime();
  if (Number.isNaN(age) || age < 0 || age > withinHours * 3_600_000) return null;
  return (
    <span
      className={cn(
        "rounded-full bg-lemon/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/80",
        className,
      )}
    >
      New
    </span>
  );
}
