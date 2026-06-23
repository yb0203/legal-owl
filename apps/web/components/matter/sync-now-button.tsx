"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncMatterNow } from "@/app/(app)/matters/[id]/actions";

// "Sync now" for a single matter — fetches its CNR from eCourts and diffs.
export function SyncNowButton({ matterId, hasCnr }: { matterId: string; hasCnr: boolean }) {
  const [pending, start] = useTransition();
  if (!hasCnr) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await syncMatterNow(matterId);
          if (r.ok) {
            const n = r.summary.created;
            toast.success(n > 0 ? `Synced — ${n} new update${n === 1 ? "" : "s"}` : "Up to date");
          } else if (r.reason === "not_found") {
            toast.error("That CNR didn't resolve on eCourts");
          } else if (r.reason === "no_cnr") {
            toast.error("Add a CNR to sync this matter");
          } else {
            toast.error("Sync failed — try again");
          }
        })
      }
    >
      <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
      Sync now
    </Button>
  );
}
