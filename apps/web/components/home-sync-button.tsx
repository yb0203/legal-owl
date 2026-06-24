"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncAllMatters } from "@/app/(app)/settings/actions";

// "Sync" on Home — pulls every matter with a CNR from eCourts, then toasts
// "N new updates". New updates land in the Inbox with a New badge.
export function HomeSyncButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await syncAllMatters();
          if (!r.ok) {
            toast.error("Couldn't sync");
            return;
          }
          if (r.total === 0) {
            toast("No matters with a CNR to sync yet");
            return;
          }
          const n = r.updates;
          if (n > 0) {
            toast.success(`${n} new court update${n === 1 ? "" : "s"}`, {
              description: "Review them in your Inbox.",
            });
            router.refresh();
          } else {
            toast.success("All matters up to date");
          }
        })
      }
    >
      <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
      Sync
    </Button>
  );
}
