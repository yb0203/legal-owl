import Link from "next/link";
import { ChevronRight, Landmark, AlarmClock, CircleCheck, FilePlus2, Plus, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSystemWorkflowStates } from "@/lib/db";
import { FORUM_LABELS, type ForumType } from "@/lib/types";
import { fmtDateLong, fmtDate, relativeDay } from "@/lib/format";
import { HearingPill } from "@/components/badges";
import { Stat, EmptyState } from "@/components/page-header";
import { TaskRow, type CrossTask } from "@/components/tasks-list";
import { TimeGroups, groupByTimeHorizon } from "@/components/time-groups";
import { HelpLink } from "@/components/help/help-link";
import { Button, buttonVariants } from "@/components/ui/button";
import { seedSampleData } from "./actions";

interface HearingLite {
  id: string;
  hearing_date: string;
  purpose: string | null;
  matter: { id: string; title: string; forum_type: ForumType } | null;
}
interface DeadlineLite {
  id: string;
  due_date: string;
  type: string;
  basis: string | null;
  matter: { id: string; title: string } | null;
}

function greeting(): string {
  // Use IST, not the server's timezone (Vercel runs UTC).
  const h = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function HomePage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const weekEnd = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  const { count: matterCount } = await supabase
    .from("matters")
    .select("id", { count: "exact", head: true });
  if ((matterCount ?? 0) === 0) return <Onboarding />;

  const [
    { count: inboxCount },
    { count: openTasks },
    { data: workRows },
    states,
    { data: hearings },
    { data: deadlines },
  ] = await Promise.all([
    supabase
      .from("triage_items")
      .select("id", { count: "exact", head: true })
      .eq("state", "pending")
      .or(`snoozed_until.is.null,snoozed_until.lte.${now}`),
    supabase.from("actions").select("id", { count: "exact", head: true }).is("completed_at", null),
    // Open tasks due within the week (incl. overdue) — grouped by time-horizon.
    supabase
      .from("actions")
      .select(
        "id, title, priority, due_date, completed_at, state_id, state:workflow_states(name, type), matter:matters(id, title)",
      )
      .is("completed_at", null)
      .not("due_date", "is", null)
      .lte("due_date", weekEnd)
      .order("due_date", { ascending: true })
      .returns<CrossTask[]>(),
    getSystemWorkflowStates(supabase),
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

  const work = workRows ?? [];
  const { groups } = groupByTimeHorizon(work, (t) => t.due_date);
  const overdueCount = groups.find((g) => g.bucket === "overdue")?.items.length ?? 0;

  return (
    <main className="mx-auto w-full max-w-6xl p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">{greeting()}</h1>
          <p className="mt-1 tnum text-sm text-muted-foreground">{fmtDateLong(today)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/matters/new" className={buttonVariants({ size: "sm" })}>
            <FilePlus2 className="size-4" /> New matter
          </Link>
          <Link href="/tasks" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Plus className="size-4" /> Add task
          </Link>
          <Link href="/inbox" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Inbox className="size-4" /> Inbox
          </Link>
          <HelpLink anchor="getting-started" label="Home" />
        </div>
      </div>

      <section className="mt-6 grid grid-cols-3 gap-4">
        <Stat label="Open tasks" value={openTasks ?? 0} href="/tasks" />
        <Stat label="Overdue" value={overdueCount} href="/tasks?filter=overdue" tone="urgent" />
        <Stat label="In inbox" value={inboxCount ?? 0} href="/inbox" />
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Left: the day's fixed obligations. */}
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Next hearings</h2>
            {(hearings?.length ?? 0) === 0 ? (
              <EmptyState
                icon={Landmark}
                title="No upcoming hearings"
                description="Scheduled hearings across your matters appear here, soonest first."
              />
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

          {(deadlines?.length ?? 0) > 0 && (
            <section>
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
        </div>

        {/* Right: the work to action, grouped by urgency. */}
        <div className="space-y-6">
          {(inboxCount ?? 0) > 0 && (
            <Link
              href="/inbox"
              className="flex items-center justify-between gap-3 rounded-xl border border-lemon/40 bg-lemon/10 px-4 py-3 text-sm transition-colors hover:bg-lemon/15"
            >
              <span className="font-medium">
                {inboxCount} court update{inboxCount === 1 ? "" : "s"} need your review
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                Open inbox <ChevronRight className="size-4" />
              </span>
            </Link>
          )}

          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Your work</h2>
            {work.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-sm">
                <CircleCheck className="size-4 shrink-0 text-primary" />
                <span className="text-muted-foreground">
                  You&apos;re clear for the week — nothing due in the next 7 days.
                </span>
              </div>
            ) : (
              <TimeGroups
                groups={groups}
                renderRow={(t) => <TaskRow task={t} states={states} />}
                rowKey={(t) => t.id}
              />
            )}
          </section>
        </div>
      </div>
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
