import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { Callout } from "@/components/layout";

// Shown app-wide while "See it in action" sample data is loaded, so the lawyer
// can never mistake seeded matters/court events for their real, synced data.
// (Seeded court_events carry source_type "ecourt", so without this banner they
// render identically to a genuine eCourts sync.)
export function SampleDataBanner() {
  return (
    <Callout
      tone="lemon"
      className="flex items-center justify-center gap-2 rounded-none border-x-0 border-t-0 px-4 py-2 text-center text-xs"
    >
      <FlaskConical className="size-3.5 shrink-0" />
      <span>
        You&apos;re exploring with <strong className="font-medium">sample data</strong>. Turn it off
        any time in{" "}
        <Link href="/settings" className="underline underline-offset-2">
          Settings
        </Link>
        .
      </span>
    </Callout>
  );
}
