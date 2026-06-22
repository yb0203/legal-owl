import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

// A compact, on-brand orientation card explaining how Legal Owl is structured.
// Shown only in empty/first-run states on Home so the populated command center
// stays clean. Links into the deepened Help glossary.
const STEPS = [
  { term: "Client", meaning: "who you act for" },
  { term: "Engagement", meaning: "a body of work for them" },
  { term: "Matter", meaning: "a single case file" },
  { term: "Action", meaning: "a task on that matter" },
] as const;

export function ModelOrientation({ className }: { className?: string }) {
  return (
    <section
      className={`rounded-xl border border-primary/25 bg-primary/5 p-5 ${className ?? ""}`}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <h2 className="font-serif text-sm font-semibold tracking-tight">
          How Legal Owl is structured
        </h2>
      </div>

      <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
        {STEPS.map((s, i) => (
          <li key={s.term} className="flex items-center gap-2">
            <span className="rounded-md border bg-card px-2 py-1">
              <span className="font-medium">{s.term}</span>
              <span className="ml-1.5 text-xs text-muted-foreground">{s.meaning}</span>
            </span>
            {i < STEPS.length - 1 && (
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            )}
          </li>
        ))}
      </ol>

      <p className="mt-4 text-sm text-muted-foreground">
        Hearings, deadlines, documents, and the court Inbox all hang off a Matter — the case
        file everything lands on.
      </p>

      <Link
        href="/help#glossary"
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:underline"
      >
        Learn how it fits together
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </section>
  );
}
