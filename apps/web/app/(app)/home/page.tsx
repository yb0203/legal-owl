import Link from "next/link";
import { ChevronRight, Landmark, AlarmClock, CircleCheck, FilePlus2, Plus, Inbox, Scale } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSystemWorkflowStates, getSystemStateId } from "@/lib/db";
import { FORUM_LABELS, type ForumType, type TaskAttributes } from "@/lib/types";
import { fmtDateLong, fmtDate, relativeDay } from "@/lib/format";
import { HearingPill } from "@/components/badges";
import { Stat, EmptyState } from "@/components/page-header";
import { TaskRow, type CrossTask } from "@/components/tasks-list";
import { TimeGroups, groupByTimeHorizon } from "@/components/time-groups";
import { HelpLink } from "@/components/help/help-link";
import { HomeSyncButton } from "@/components/home-sync-button";
import { ModelOrientation } from "@/components/model-orientation";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageShell, Panel, SectionHeading, List, ListRow, Callout } from "@/components/layout";
import { seedSampleData } from "./actions";
import { fetchAndStoreCauseList, type CauseListEntry } from "@/lib/ecourts/cause-list";

interface HearingLite {
  id: string;
  due_date: string;
  attributes: TaskAttributes;
  matter: { id: string; title: string; forum_type: ForumType } | null;
}
interface DeadlineLite {
  id: string;
  due_date: string;
  attributes: TaskAttributes;
  matter: { id: string; title: string } | null;
}

function deadlineLabel(type?: string): string {
  const t = type ?? "internal";
  return t[0].toUpperCase() + t.slice(1);
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

  const triageId = await getSystemStateId(supabase, "Triage");

  const [
    { count: inboxCount },
    { count: openTasks },
    { data: workRows },
    states,
    { data: hearings },
    { data: deadlines },
  ] = await Promise.all([
    // Inbox = type='task' rows parked in the Triage state (minus snoozed).
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("type", "task")
      .eq("state_id", triageId ?? "")
      .or(`snoozed_until.is.null,snoozed_until.lte.${now}`),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("type", "task")
      .neq("state_id", triageId ?? "")
      .is("completed_at", null),
    // Open tasks due within the week (incl. overdue) — grouped by time-horizon.
    supabase
      .from("tasks")
      .select(
        "id, title, priority, due_date, completed_at, state_id, state:workflow_states(name, type), matter:matters(id, title)",
      )
      .eq("type", "task")
      .neq("state_id", triageId ?? "")
      .is("completed_at", null)
      .not("due_date", "is", null)
      .lte("due_date", weekEnd)
      .order("due_date", { ascending: true })
      .returns<CrossTask[]>(),
    getSystemWorkflowStates(supabase),
    supabase
      .from("tasks")
      .select("id, due_date, attributes, matter:matters(id, title, forum_type)")
      .eq("type", "hearing")
      .eq("attributes->>court_state", "scheduled")
      .gte("due_date", today)
      .order("due_date", { ascending: true })
      .limit(5)
      .returns<HearingLite[]>(),
    supabase
      .from("tasks")
      .select("id, due_date, attributes, matter:matters(id, title)")
      .eq("type", "deadline")
      .gte("due_date", today)
      .order("due_date", { ascending: true })
      .limit(5)
      .returns<DeadlineLite[]>(),
  ]);

  const work = workRows ?? [];
  const { groups } = groupByTimeHorizon(work, (t) => t.due_date);

  // Cause list — best-effort, never throws.
  let causeListEntries: CauseListEntry[] = [];
  try {
    causeListEntries = await fetchAndStoreCauseList(supabase, today);
  } catch {
    // Don't let cause list failures break the Home page.
  }
  const overdueCount = groups.find((g) => g.bucket === "overdue")?.items.length ?? 0;

  return (
    <PageShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">{greeting()}</h1>
          <p className="mt-1 tnum text-sm text-muted-foreground">{fmtDateLong(today)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/matters/new" className={buttonVariants({ size: "sm" })}>
            <FilePlus2 className="size-4" /> New matter
          </Link>
          <HomeSyncButton />
          <Link href="/tasks" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Plus className="size-4" /> Add task
          </Link>
          <Link href="/inbox" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Inbox className="size-4" /> Inbox
          </Link>
          <HelpLink anchor="getting-started" label="Home" />
        </div>
      </div>

      <section data-tour="board" className="mt-6 grid grid-cols-3 gap-4">
        <Stat label="Open tasks" value={openTasks ?? 0} href="/tasks" />
        <Stat label="Overdue" value={overdueCount} href="/tasks?filter=overdue" tone="urgent" />
        <Stat label="In inbox" value={inboxCount ?? 0} href="/inbox" />
      </section>

      {/* Single column, ordered by what a lawyer acts on first:
          what changed → today's hearings → deadlines → the rest of the work. */}
      <div className="mt-8 space-y-8">
        {(inboxCount ?? 0) > 0 && (
          <Callout
            as={Link}
            tone="lemon"
            href="/inbox"
            className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-lemon/15"
          >
            <span className="font-medium">
              {inboxCount} court update{inboxCount === 1 ? "" : "s"} need your review
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              Open inbox <ChevronRight className="size-4" />
            </span>
          </Callout>
        )}

        {causeListEntries.length > 0 && (
          <section>
            <SectionHeading>Courts today</SectionHeading>
            <List>
              {causeListEntries.map((entry) => (
                <ListRow
                  key={`${entry.matter_id}-${entry.serial_no}`}
                  href={`/matters/${entry.matter_id}`}
                  leading={<Scale className="size-4 shrink-0 text-primary" />}
                  title={entry.matter_title}
                  subtitle={
                    <>
                      {entry.court_code}
                      {entry.serial_no != null && ` · #${entry.serial_no}`}
                      {entry.purpose && ` · ${entry.purpose}`}
                    </>
                  }
                  trailing={
                    entry.slot_time ? (
                      <span className="tnum shrink-0 text-xs text-muted-foreground">
                        {entry.slot_time}
                      </span>
                    ) : null
                  }
                />
              ))}
            </List>
          </section>
        )}

        <section>
          <SectionHeading>Next hearings</SectionHeading>
          {(hearings?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Landmark}
              title="No upcoming hearings"
              description="Scheduled hearings across your matters appear here, soonest first."
            />
          ) : (
            <List>
              {hearings!.map((h) => (
                <ListRow
                  key={h.id}
                  href={h.matter ? `/matters/${h.matter.id}` : "#"}
                  leading={<Landmark className="size-4 shrink-0 text-primary" />}
                  title={h.matter?.title ?? "Matter"}
                  subtitle={
                    <>
                      {h.attributes?.purpose ?? "Hearing"}
                      {h.matter ? ` · ${FORUM_LABELS[h.matter.forum_type]}` : ""}
                    </>
                  }
                  trailing={<HearingPill date={h.due_date} />}
                />
              ))}
            </List>
          )}
        </section>

        {(deadlines?.length ?? 0) > 0 && (
          <section>
            <SectionHeading>Upcoming deadlines</SectionHeading>
            <List>
              {deadlines!.map((d) => (
                <ListRow key={d.id} className="py-3 text-sm">
                  <AlarmClock className="size-4 shrink-0 text-lemon" />
                  <span className="min-w-0 flex-1 truncate">
                    {d.attributes?.basis ?? `${deadlineLabel(d.attributes?.deadline_type)} deadline`}
                    {d.matter && <span className="ml-2 text-xs text-muted-foreground">{d.matter.title}</span>}
                  </span>
                  <span className="tnum shrink-0 text-xs text-muted-foreground">
                    {fmtDate(d.due_date)} · {relativeDay(d.due_date)}
                  </span>
                </ListRow>
              ))}
            </List>
          </section>
        )}

        <section>
          <SectionHeading>Your work</SectionHeading>
          {work.length === 0 ? (
            <div className="space-y-6">
              <Panel className="flex items-center gap-3 px-4 py-3.5 text-sm">
                <CircleCheck className="size-4 shrink-0 text-primary" />
                <span className="text-muted-foreground">
                  You&apos;re clear for the week — nothing due in the next 7 days.
                </span>
              </Panel>
              {(openTasks ?? 0) === 0 && <ModelOrientation />}
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
    </PageShell>
  );
}

function Onboarding() {
  return (
    <PageShell size="sm" className="flex flex-col items-center py-16 text-center sm:py-24">
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
      <ModelOrientation className="mt-10 w-full text-left" />
    </PageShell>
  );
}
