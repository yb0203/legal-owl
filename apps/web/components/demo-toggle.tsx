"use client";

import { useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { seedSampleData, clearSampleData } from "@/app/(app)/home/actions";

// "See it in action" — turning on seeds demo data (and lands on Today);
// turning off removes it.
export function DemoToggle({ enabled }: { enabled: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <div className="text-sm font-medium">See it in action</div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Load sample matters, hearings, and tasks to explore the whole app.
          Turn off any time to remove them.
        </p>
      </div>
      <Switch
        checked={enabled}
        disabled={pending}
        aria-label="See it in action"
        onCheckedChange={(checked) =>
          startTransition(() => {
            if (checked) seedSampleData();
            else clearSampleData();
          })
        }
      />
    </div>
  );
}
