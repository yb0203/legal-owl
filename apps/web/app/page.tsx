import Link from "next/link";
import { joinWaitlist } from "./waitlist/actions";
import { Wordmark } from "@/components/wordmark";
import { OwlMark } from "@/components/owl-mark";
import { Reveal } from "@/components/reveal";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STEPS: [string, string, string][] = [
  ["01", "Add a matter", "Paste a CNR or search by party name — district court, High Court, NCLT, arbitration."],
  ["02", "We watch the courts", "Daily eCourts sync. Every order, hearing date, and status change is captured."],
  ["03", "Triage into action", "New developments land in an inbox. Accept the ones that need work; the rest stay on the record."],
  ["04", "Keep clients informed", "Turn a court event into a plain-language update. You approve, it sends."],
];

const TRACKS: [string, string][] = [
  ["Court monitoring", "Your matters sync from eCourts automatically — no more portal checks."],
  ["Case workflow", "Hearings, orders, and your to-dos as one clear ledger per matter."],
  ["Lawyer assist", "An assistant that drafts and answers, grounded in your real case data."],
  ["Client updates", "Court events become client updates. Your approval, always."],
];

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Wordmark />
        <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Sign in
        </Link>
      </header>

      {/* Large dimmed owl backdrop — viewport-anchored, bleeds off the right edge */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-2/3 top-24 -z-10 hidden md:block"
      >
        <div className="relative size-[34rem] -translate-x-1/2">
          <div className="absolute inset-10 rounded-full bg-primary/10 blur-3xl" />
          <div className="owl-ring absolute inset-0 rounded-full opacity-60" />
          <div className="absolute inset-0 grid place-items-center">
            <OwlMark className="size-[20rem] text-foreground opacity-[0.07]" />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6">
        {/* Hero — type-led */}
        <section className="py-20 sm:py-28 lg:py-36">
          <div className="relative max-w-4xl animate-in fade-in slide-in-from-bottom-3 duration-700">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              For solo lawyers · India
            </p>
            <h1 className="mt-6 font-serif text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl lg:text-7xl">
              The AI-native legal office,{" "}
              <span className="underline decoration-lemon decoration-[5px] underline-offset-[8px]">
                built for India&apos;s courts.
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              Track your cases, turn every court update into action, and keep clients
              informed — grounded in real case data, never guesswork.
            </p>

            <form action={joinWaitlist} className="mt-10 flex max-w-md flex-col gap-2 sm:flex-row">
              <Input
                name="email"
                type="email"
                required
                placeholder="you@chambers.in"
                aria-label="Email"
                className="h-12 bg-card text-base"
              />
              <Button type="submit" size="lg" className="h-12 shrink-0 px-6 text-base">
                Join the waitlist
              </Button>
            </form>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
            <p className="mt-4 text-sm text-muted-foreground">
              Invite-only for now. Already approved?{" "}
              <Link href="/login" className="text-foreground underline underline-offset-4">
                Sign in
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Showcase — the one product visual */}
        <Reveal className="border-t py-20 sm:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
                A living record of every matter.
              </h2>
              <p className="mt-4 max-w-md text-muted-foreground">
                Court events and your own notes on one timeline. The next hearing always
                in view. The case number always a tap away.
              </p>
            </div>
            <div className="lg:justify-self-end">
              <CaseRecordCard />
            </div>
          </div>
        </Reveal>

        {/* How it works — numbered roadmap */}
        <Reveal className="border-t py-20 sm:py-28">
          <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            How it works.
          </h2>
          <div className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2">
            {STEPS.map(([n, title, body], i) => (
              <Reveal key={n} delay={i * 80} className="flex gap-5">
                <span className="font-serif text-3xl font-semibold text-primary tnum">{n}</span>
                <div>
                  <h3 className="text-lg font-medium">{title}</h3>
                  <p className="mt-1.5 text-muted-foreground">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>

        {/* Tracks */}
        <Reveal className="border-t py-20 sm:py-28">
          <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for the whole practice.
          </h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2">
            {TRACKS.map(([title, body]) => (
              <div key={title} className="bg-card p-6 transition-colors hover:bg-accent/50">
                <h3 className="font-medium">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Final CTA */}
        <Reveal className="border-t py-24 text-center sm:py-32">
          <h2 className="mx-auto max-w-2xl font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
            Be among the first lawyers on Legal Owl.
          </h2>
          <Link href="#top" className={buttonVariants({ size: "lg", className: "mt-8 h-12 px-7 text-base" })}>
            Join the waitlist
          </Link>
        </Reveal>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <Wordmark className="opacity-80" />
          <p>Built for India · Your case data stays in India.</p>
        </div>
      </footer>
    </div>
  );
}

function CaseRecordCard() {
  return (
    <div className="relative w-full max-w-sm transition-transform duration-300 hover:-translate-y-1">
      <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-2xl border bg-card/60" aria-hidden />
      <article className="relative rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-lg font-semibold leading-tight">MBECL vs SCCL</h3>
          <span className="shrink-0 rounded-full bg-lemon px-2.5 py-0.5 text-xs font-medium text-lemon-foreground">
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

        <div className="mt-4 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3 py-2">
          <span className="text-sm font-medium">Next hearing</span>
          <span className="tnum text-sm font-semibold">24 Jun · in 3 days</span>
        </div>

        <ol className="mt-4 space-y-3 border-t pt-4">
          <TimelineRow color="bg-primary" label="Order uploaded" date="12 Jun" />
          <TimelineRow color="bg-muted-foreground/40" label="Client informed of new date" date="14 Jun" />
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
