import * as React from "react";
import { cn } from "@/lib/utils";

export interface PropertyRow {
  label: string;
  /** The attribute value. Null/undefined/"" renders as an em dash. */
  value: React.ReactNode;
  /** Optional rule/annotation shown next to the value (e.g. a <RuleHint>). */
  hint?: React.ReactNode;
}

// A consistent definition-list of a record's attributes. Every entity surface
// uses this so records read the same way everywhere (the "record shell").
export function PropertiesRail({
  items,
  className,
}: {
  items: PropertyRow[];
  className?: string;
}) {
  return (
    <dl className={cn("divide-y", className)}>
      {items.map((it) => {
        const empty = it.value === null || it.value === undefined || it.value === "";
        return (
          <div key={it.label} className="grid grid-cols-[7.5rem_1fr] items-start gap-3 py-2.5 text-sm">
            <dt className="text-muted-foreground">{it.label}</dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
              {empty ? <span className="text-muted-foreground">—</span> : it.value}
              {it.hint}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
