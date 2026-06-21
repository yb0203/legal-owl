import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FORUM_LABELS, type Matter } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { seedSampleData } from "./actions";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default async function TodayPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { count: matterCount } = await supabase
    .from("matters")
    .select("id", { count: "exact", head: true });

  if ((matterCount ?? 0) === 0) return <Onboarding />;

  const [{ data: hearings }, { count: triageCount }, { count: openActions }] =
    await Promise.all([
      supabase
        .from("matters")
        .select("id, key, title, forum_type, next_hearing_date")
        .gte("next_hearing_date", today)
        .order("next_hearing_date", { ascending: true })
        .limit(6)
        .returns<Matter[]>(),
      supabase.from("triage_items").select("id", { count: "exact", head: true }).eq("state", "pending"),
      supabase.from("actions").select("id", { count: "exact", head: true }).is("completed_at", null),
    ]);

  const upcoming = hearings ?? [];
  const longDate = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Today</h1>
      <p className="mt-1 text-sm text-muted-foreground tnum">{longDate}</p>

      {(triageCount ?? 0) > 0 && (
        <Link
          href="/inbox"
          className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-lemon/40 bg-lemon/10 px-4 py-3 text-sm transition-colors hover:bg-lemon/15"
        >
          <span className="font-medium">
            {triageCount} court update{triageCount === 1 ? "" : "s"} need your review
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            Open inbox <ChevronRight className="size-4" />
          </span>
        </Link>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">Upcoming hearings</h2>
        {upcoming.length === 0 ? (
          <Empty>No upcoming hearings on record.</Empty>
        ) : (
          <ul className="mt-3 divide-y overflow-hidden rounded-xl border">
            {upcoming.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/matters/${m.id}`}
                  className="flex items-center justify-between gap-3 bg-card px-4 py-3 transition-colors hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{m.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {FORUM_LABELS[m.forum_type]} · <span className="font-mono tnum">{m.key}</span>
                    </div>
                  </div>
                  <span className="tnum shrink-0 text-sm font-semibold">
                    {m.next_hearing_date ? fmtDate(m.next_hearing_date) : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 grid grid-cols-2 gap-4">
        <Stat label="Open tasks" value={openActions ?? 0} href="/tasks" />
        <Stat label="In inbox" value={triageCount ?? 0} href="/inbox" />
      </section>
    </main>
  );
}

function Onboarding() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center p-6 py-16 text-center sm:py-24">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Welcome to Legal Owl</h1>
      <p className="mt-3 text-muted-foreground">
        Track your court cases, turn updates into action, and keep clients informed.
        Add your first matter, or load a few sample matters to see how it all works.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <form action={seedSampleData}>
          <Button type="submit" size="lg">
            Load sample data
          </Button>
        </form>
        <Link href="/matters/new" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Add your first matter
        </Link>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        You can toggle sample data any time in Settings.
      </p>
    </main>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40">
      <div className="tnum font-serif text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </Link>
  );
}
