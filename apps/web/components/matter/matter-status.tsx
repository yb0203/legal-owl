"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { MATTER_STATUSES, type MatterStatus } from "@/lib/types";
import { setMatterStatus, archiveMatter } from "@/app/(app)/matters/[id]/actions";

const LABELS: Record<MatterStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  disposed: "Disposed",
};

const selectCls =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

export function MatterStatusControl({
  matterId,
  status,
  archived,
}: {
  matterId: string;
  status: MatterStatus;
  archived: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Matter status"
        className={selectCls}
        defaultValue={status}
        disabled={pending}
        onChange={(e) => start(() => setMatterStatus(matterId, e.target.value))}
      >
        {MATTER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {LABELS[s]}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => archiveMatter(matterId, !archived))}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent/40 disabled:opacity-50"
      >
        {archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
        {archived ? "Unarchive" : "Archive"}
      </button>
    </div>
  );
}
