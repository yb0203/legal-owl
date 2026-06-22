import Link from "next/link";
import { CircleHelp } from "lucide-react";
import type { HelpAnchor } from "@/lib/help/content";

// A quiet "?" that deep-links to the relevant section of /help. The anchor is
// typed against the help content registry, so a bad link is a build error.
export function HelpLink({ anchor, label = "Help" }: { anchor: HelpAnchor; label?: string }) {
  return (
    <Link
      href={`/help#${anchor}`}
      aria-label={`Help: ${label}`}
      title="How to use this"
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
    >
      <CircleHelp className="size-4" />
    </Link>
  );
}
