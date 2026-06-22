import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

// A quiet annotation that makes a rule visible without clutter: an info glyph +
// short text, with the full rule available on hover (native title). Use it to
// label computed/invariant fields ("computed from the earliest scheduled
// hearing", "append-only", "stored in India").
export function RuleHint({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}
      title={typeof children === "string" ? children : undefined}
    >
      <Info className="size-3 shrink-0" aria-hidden />
      <span>{children}</span>
    </span>
  );
}
