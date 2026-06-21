import Link from "next/link";
import { joinWaitlist } from "./waitlist/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TRACKS = [
  ["Case Workflow", "Track every matter and case action like tickets — synced from eCourts."],
  ["Lawyer Assist", "An AI that drafts and answers, grounded in your real case data."],
  ["Client Updates", "Turn court events into plain-language client updates, your approval first."],
];

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 py-10 sm:py-20">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold">⚖️ Legal Owl</span>
        <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Sign in
        </Link>
      </header>

      <section className="mt-16 sm:mt-24">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
          The AI-native legal office for solo lawyers.
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
          Manage cases and clients elegantly. Court monitoring, case workflow, and
          a grounded AI assistant — every answer traceable to your real case data,
          built for Indian practice.
        </p>

        <form action={joinWaitlist} className="mt-8 flex w-full max-w-md flex-col gap-2 sm:flex-row">
          <Input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="h-11"
            aria-label="Email"
          />
          <Button type="submit" size="lg" className="h-11 shrink-0">
            Join the waitlist
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <p className="mt-2 text-xs text-muted-foreground">
          We&apos;re onboarding lawyers gradually. Already approved?{" "}
          <Link href="/login" className="underline underline-offset-4">
            Sign in
          </Link>
          .
        </p>
      </section>

      <section className="mt-16 grid gap-4 sm:mt-24 sm:grid-cols-3">
        {TRACKS.map(([title, body]) => (
          <div key={title} className="rounded-lg border p-4">
            <h3 className="text-sm font-medium">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-auto pt-16 text-xs text-muted-foreground">
        © Legal Owl · Built for solo lawyers in India
      </footer>
    </main>
  );
}
