import { cn } from "@/lib/utils";
import type { Label } from "@/lib/types";

// A calm "dot + name" tag chip. The label's stored color (free-text) tints only
// the small dot, so an arbitrary value can never break the theme-consistent
// chip surface. No color → a neutral muted dot.
export function LabelChip({
  label,
  className,
  onRemove,
}: {
  label: Label;
  className?: string;
  onRemove?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-xs text-foreground/90",
        className,
      )}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: label.color ?? "var(--muted-foreground)" }}
      />
      {label.name}
      {onRemove}
    </span>
  );
}
