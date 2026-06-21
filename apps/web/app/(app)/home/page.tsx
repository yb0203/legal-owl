import Link from "next/link";
import { ChevronRight, Landmark, AlarmClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FORUM_LABELS, type ForumType } from "@/lib/types";
import { fmtDateLong, fmtDate, relativeDay } from "@/lib/format";
import { HearingPill } from "@/components/badges";
import { Stat, EmptyState } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { seedSampleData } from "./actions";

interface HearingLite {
  id: string;
  hearing_date: string;
  purpose: string | null;
  matter: { id: string; title: string; forum_type: ForumType } | null;
}
interface TaskLite {
  id: string;
  title: string;
  due_date: string | null;
  matter: { id: string; title: string } | null;
}
interface DeadlineLite {
  id: string;
  due_date: string;
  type: string;
  basis: string | null;
  matter: { id: string; title: string } | null;
}

export default async function HomePage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const { count: matterCount } = await supabase
    .from("matters")
    .select("id", { count: "exact", head: true });
  if ((matterCount ?? 0) === 0) return <Onboarding />;

  const [
    { count: inboxCount },
    { count: openTasks },
    { data: overdue },
    { data: hearings },
    { data: deadlines },
  ] = await Promise.all([
    supabase
      .from("triage_items")
      .select("id", { count: "exact", head: true })
      .eq("state", "pending")
      .or(`snoozed_until.is.null,snoozed_until.lte.${now}`),
    supabase.from("actions").select("id", { count: "exact", head: true }).is("completed_at", null),
    supabase
      .from("actions")
      .select("id, title, due_date, matter:matters(id, title)")
      .is("completed_at", null)
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .returns<TaskLite[]>(),
    supabase
      .from("hearings")
      .select("id, hearing_date, purpose, matter:matters(id, title, forum_type)")
      .eq("state", "scheduled")
      .gte("hearing_date", today)
      .order("hearing_date", { ascending: true })
      .limit(5)
      .returns<HearingLite[]>(),
    supabase
      .from("deadlines")
      .select("id, due_date, type, basis, matter:matters(id, title)")
      .gte("due_date", today)
      .order("due_date", { ascending: true })
      .limit(5)
      .returns<DeadlineLite[]>(),
  ]);

  const overdueTasks = overdue ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Home</h1>
      <p className="mt-1 text-sm text-muted-foreground tnum">{fmtDateLong(today)}</p>

      {(inboxCount ?? 0) > 0 && (
        <Link
          href="/inbox"
          className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-lemon/40 bg-lemon/10 px-4 py-3 text-sm transition-colors hover:bg-lemon/15"
        >
          <span className="font-medium">
            {inboxCount} court update{inboxCount === 1 ? "" : "s"} need your review
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            Open inbox <ChevronRight className="size-4" />
          </span>
        </Link>
      )}

      <section className="mt-6 grid grid-cols-3 gap-4">
        <Stat label="Open tasks" value={openTasks ?? 0} href="/tasks" />
        <Stat label="Overdue" value={overdueTasks.length} href="/tasks?filter=overdue" tone="urgent" />
        <Stat label="In inbox" value={inboxCount ?? 0} href="/inbox" />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Next hearings</h2>
        {(hearings?.length ?? 0) === 0 ? (
          <EmptyState title="No upcoming hearings" />
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border">
            {hearings!.map((h) => (
              <li key={h.id}>
                <Link
                  href={h.matter ? `/matters/${h.matter.id}` : "#"}
                  className="flex items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-accent/40"
                >
                  <Landmark className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{h.matter?.title ?? "Matter"}</div>
                    <div className="text-xs text-muted-foreground">
                      {h.purpose ?? "Hearing"}
                      {h.matter ? ` · ${FORUM_LABELS[h.matter.forum_type]}` : ""}
                    </div>
                  </div>
                  <HearingPill date={h.hearing_date} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {overdueTasks.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Needs attention</h2>
          <ul className="divide-y overflow-hidden rounded-xl border">
            {overdueTasks.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 bg-card px-4 py-3 text-sm">
                <Link href={t.matter ? `/matters/${t.matter.id}` : "/tasks"} className="min-w-0 hover:underline">
                  <span className="truncate">{t.title}</span>
                  {t.matter && <span className="ml-2 text-xs text-muted-foreground">{t.matter.title}</span>}
                </Link>
                {t.due_date && (
                  <span className="tnum shrink-0 rounded bg-urgent px-1.5 py-0.5 text-xs font-medium text-white">
                    due {fmtDate(t.due_date)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(deadlines?.length ?? 0) > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Upcoming deadlines</h2>
          <ul className="divide-y overflow-hidden rounded-xl border">
            {deadlines!.map((d) => (
              <li key={d.id} className="flex items-center gap-3 bg-card px-4 py-3 text-sm">
                <AlarmClock className="size-4 shrink-0 text-lemon" />
                <span className="min-w-0 flex-1 truncate">
                  {d.basis ?? `${d.type[0].toUpperCase()}${d.type.slice(1)} deadline`}
                  {d.matter && <span className="ml-2 text-xs text-muted-foreground">{d.matter.title}</span>}
                </span>
                <span className="tnum shrink-0 text-xs text-muted-foreground">
                  {fmtDate(d.due_date)} · {relativeDay(d.due_date)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Onboarding() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center p-6 py-16 text-center sm:py-24">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Welcome to Legal Owl</h1>
      <p className="mt-3 text-muted-foreground">
        Track your cases, turn every court update into action, and keep clients informed.
        Add your first matter, or load sample data to see how it all works.
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
      <p className="mt-4 text-xs text-muted-foreground">You can toggle sample data any time in Settings.</p>
    </main>
  );
}
