import Link from "next/link";
import { joinWaitlist } from "./waitlist/actions";
import { Wordmark } from "@/components/wordmark";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TRACKS: [string, string][] = [
  ["Court monitoring", "Your eCourts matters sync automatically — no more checking the portal."],
  ["Case workflow", "Hearings, orders, and your to-dos as one clear, tracked ledger per matter."],
  ["Lawyer assist", "An assistant that drafts and answers — grounded in your real case data, with sources."],
  ["Client updates", "Turn a court event into a plain-language client update. You approve, it sends."],
];

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Wordmark />
        <Link
          href="/login"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        {/* Hero */}
        <section className="grid items-center gap-12 py-12 sm:py-20 lg:grid-cols-2 lg:gap-10">
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-700">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              For solo lawyers · India
            </p>
            <h1 className="mt-4 font-serif text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              The AI-native legal office for solo lawyers.
            </h1>
            <p className="mt-5 max-w-md text-base text-muted-foreground sm:text-lg">
              Legal Owl tracks your court cases, turns updates into action, and keeps
              clients informed — every answer traceable to your real case data.
            </p>

            <form action={joinWaitlist} className="mt-7 flex max-w-md flex-col gap-2 sm:flex-row">
              <Input
                name="email"
                type="email"
                required
                placeholder="you@chambers.in"
                aria-label="Email"
                className="h-11 bg-card"
              />
              <Button type="submit" size="lg" className="h-11 shrink-0">
                Join the waitlist
              </Button>
            </form>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
            <p className="mt-3 text-xs text-muted-foreground">
              Invite-only for now. Already approved?{" "}
              <Link href="/login" className="text-foreground underline underline-offset-4">
                Sign in
              </Link>
              .
            </p>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 lg:justify-self-end">
            <CaseRecordCard />
          </div>
        </section>

        {/* Value — the four tracks, as a ruled register, not a card grid */}
        <section className="border-t py-12 sm:py-16">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            One ledger for the whole practice.
          </h2>
          <div className="mt-8 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
            {TRACKS.map(([title, body]) => (
              <div
                key={title}
                className="bg-card p-5 transition-colors hover:bg-accent/40"
              >
                <h3 className="text-sm font-medium">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="border-t py-14 text-center sm:py-20">
          <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
            Be among the first lawyers on Legal Owl.
          </h2>
          <Link
            href="#top"
            className={buttonVariants({ size: "lg", className: "mt-6" })}
          >
            Join the waitlist
          </Link>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row">
          <Wordmark className="opacity-80" />
          <p>Built for India · Your case data stays in India.</p>
        </div>
      </footer>
    </div>
  );
}

// The hero "art": a real-looking case record, the product rendered as a poster.
function CaseRecordCard() {
  return (
    <div className="relative w-full max-w-sm">
      <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-xl border bg-card/60" aria-hidden />
      <article className="relative rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-lg font-semibold leading-tight">
            MBECL vs SCCL
          </h3>
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
            In progress
          </span>
        </div>

        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="uppercase tracking-wide">CNR</span>
          <span className="tnum font-mono text-foreground/80">TSHC010004232025</span>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          Singareni Collieries Co. Ltd. <span className="text-muted-foreground/60">v.</span>{" "}
          McNally Bharat Engineering
        </p>

        <div className="mt-4 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium text-primary">Next hearing</span>
          <span className="tnum text-sm font-semibold text-primary">24 Jun · in 3 days</span>
        </div>

        <ol className="mt-4 space-y-3 border-t pt-4">
          <TimelineRow color="bg-primary" label="Order uploaded" date="12 Jun" />
          <TimelineRow color="bg-muted-foreground/50" label="Client informed of new date" date="14 Jun" />
          <TimelineRow color="bg-primary" label="Hearing listed for arguments" date="24 Jun" />
        </ol>
      </article>
    </div>
  );
}

function TimelineRow({ color, label, date }: { color: string; label: string; date: string }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className={`size-1.5 shrink-0 rounded-full ${color}`} aria-hidden />
      <span className="flex-1 truncate text-foreground/90">{label}</span>
      <span className="tnum shrink-0 text-xs text-muted-foreground">{date}</span>
    </li>
  );
}
