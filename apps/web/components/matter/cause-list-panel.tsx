"use client";

import { useState, useTransition } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { viewCauseList, type CauseListEntry, type CauseListResult } from "@/app/(app)/matters/[id]/actions";

const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

// The day's court board for this matter's court — fetched only when the
// lawyer clicks "View" (never automatically), since the API is billed.
export function CauseListPanel({ courtCode }: { courtCode: string }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pending, start] = useTransition();
  const [result, setResult] = useState<CauseListResult | null>(null);

  const run = () => {
    start(async () => {
      setResult(await viewCauseList(courtCode, date));
    });
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Cause list</span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-8 w-auto text-xs"
        />
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={run}>
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          View
        </Button>
      </div>

      {result && !result.ok && (
        <p className="text-xs text-muted-foreground">Couldn&apos;t load the cause list — try again.</p>
      )}
      {result?.ok && result.entries.length === 0 && (
        <p className="text-xs text-muted-foreground">No listing found for this date.</p>
      )}
      {result?.ok && result.entries.length > 0 && (
        <ul className="space-y-1.5">
          {result.entries.map((e, i) => (
            <li key={i} className="rounded-md bg-muted/40 px-2 py-1.5 text-xs">
              <CauseListRow entry={e} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CauseListRow({ entry }: { entry: CauseListEntry }) {
  if (typeof entry.raw === "string") {
    return <pre className="whitespace-pre-wrap break-all font-mono text-[11px]">{entry.raw}</pre>;
  }
  const caseNo = str(entry.caseNo ?? entry.case_no ?? entry.serialNumber);
  const parties = str(entry.parties ?? entry.title ?? entry.caseTitle);
  const time = str(entry.time ?? entry.slot);
  const bits = [caseNo, parties, time].filter(Boolean);
  return <span>{bits.length ? bits.join(" — ") : JSON.stringify(entry).slice(0, 200)}</span>;
}
