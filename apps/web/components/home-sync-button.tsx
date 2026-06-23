"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncAllMatters } from "@/app/(app)/settings/actions";

// Fire a real desktop notification (best-effort; falls back to the toast alone).
function pushNotify(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  const fire = () => {
    try {
      new Notification(title, { body, icon: "/icon.svg" });
    } catch {
      /* notifications unavailable in this context */
    }
  };
  if (Notification.permission === "granted") fire();
  else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((p) => {
      if (p === "granted") fire();
    });
  }
}

// "Sync" on Home — pulls every matter with a CNR from eCourts, then toasts and
// (if N>0) fires a "N new updates" notification. New updates land in the Inbox
// with a New badge.
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
            const msg = `${n} new court update${n === 1 ? "" : "s"}`;
            toast.success(msg, { description: "Review them in your Inbox." });
            pushNotify(`${msg} — Legal Owl`, "Open your Inbox to review.");
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
