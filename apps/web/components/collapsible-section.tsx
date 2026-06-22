"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// A labelled, collapsible section with a count. Server components render the rows
// and pass them as `children`; only the open/close interaction is client-side.
export function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  tone = "default",
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  tone?: "default" | "urgent";
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="group/section">
      <CollapsibleTrigger
        render={
          <button
            type="button"
            className="mb-2 flex w-full items-baseline gap-2 text-left"
          />
        }
      >
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[panel-open=false]/section:-rotate-90" />
        <h2
          className={cn(
            "font-serif text-base font-semibold tracking-tight",
            tone === "urgent" && "text-urgent",
          )}
        >
          {title}
        </h2>
        <span className={cn("tnum text-xs", tone === "urgent" ? "font-medium text-urgent" : "text-muted-foreground")}>
          {count}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}
