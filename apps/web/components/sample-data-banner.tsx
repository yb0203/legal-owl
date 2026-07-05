import Link from "next/link";
import { FlaskConical, Sparkles } from "lucide-react";
import { Callout } from "@/components/layout";
import { runDemoIntake } from "@/app/(app)/home/actions";

// Shown app-wide while "See it in action" sample data is loaded, so the lawyer
// can never mistake seeded matters/activity for their real, synced data.
// (Seeded activity rows carry source "ecourt", so without this banner they
// render identically to a genuine eCourts sync.)
export function SampleDataBanner() {
  return (
    <Callout
      tone="lemon"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-none border-x-0 border-t-0 px-4 py-2 text-center text-xs"
    >
      <span className="inline-flex items-center gap-2">
        <FlaskConical className="size-3.5 shrink-0" />
        You&apos;re exploring with <strong className="font-medium">sample data</strong>. Turn it off
        any time in{" "}
        <Link href="/settings" className="underline underline-offset-2">
          Settings
        </Link>
        .
      </span>
      {/* Agentic demo: read a court order with the Intake Registrar and file its
          span-cited fact proposal into the Inbox to approve. */}
      <form action={runDemoIntake}>
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium underline underline-offset-2 hover:opacity-80"
        >
          <Sparkles className="size-3.5" /> Run Owl on the Sharma file
        </button>
      </form>
    </Callout>
  );
}
