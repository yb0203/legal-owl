"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncAllMatters } from "@/app/(app)/settings/actions";

// Sync every matter with a CNR from the eCourts Settings card.
export function SyncAllButton({ configured }: { configured: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending || !configured}
      onClick={() =>
        start(async () => {
          const r = await syncAllMatters();
          if (!r.ok) {
            toast.error("Couldn't sync");
            return;
          }
          toast.success(
            r.total === 0
              ? "No matters with a CNR yet"
              : `Synced ${r.synced}/${r.total} · ${r.changed} updated${r.failed ? ` · ${r.failed} failed` : ""}`,
          );
        })
      }
    >
      <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
      {configured ? "Sync all matters" : "Not configured"}
    </Button>
  );
}
