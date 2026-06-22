"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

// A mono chip showing an id (matter key / CNR) with a click-to-copy affordance.
export function CopyChip({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label ?? "Copied"} copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy ${label ?? value}`}
      className={cn(
        "tnum inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground",
      )}
    >
      {value}
      {copied ? <Check className="size-3 text-primary" /> : <Copy className="size-3 opacity-60" />}
    </button>
  );
}
