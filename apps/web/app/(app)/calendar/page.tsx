import Link from "next/link";
import { Landmark, AlarmClock, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/page-header";
import { HelpLink } from "@/components/help/help-link";
import { fmtDateYear, relativeDay, isToday, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageShell, List, ListRow } from "@/components/layout";
import type { TaskAttributes } from "@/lib/types";

interface HearingRow {
  id: string;
  due_date: string | null;
  attributes: TaskAttributes;
  matter: { id: string; title: string } | null;
}
interface DeadlineRow {
  id: string;
  due_date: string | null;
  attributes: TaskAttributes;
  matter: { id: string; title: string } | null;
}

interface AgendaItem {
  key: string;
  date: string;
  kind: "hearing" | "deadline";
  label: string;
  matter: { id: string; title: string } | null;
}

export default async function CalendarPage() {
  const supabase = await createClient();

  // No date floor: a missed hearing or a passed limitation date must stay
  // visible (hiding overdue is malpractice-grade). We fetch scheduled hearings
  // and all deadlines, then surface overdue first.
  const [{ data: hearings }, { data: deadlines }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, due_date, attributes, matter:matters(id, title)")
      .eq("type", "hearing")
      .eq("attributes->>court_state", "scheduled")
      .order("due_date", { ascending: true })
      .returns<HearingRow[]>(),
    supabase
      .from("tasks")
      .select("id, due_date, attributes, matter:matters(id, title)")
      .eq("type", "deadline")
      .order("due_date", { ascending: true })
      .returns<DeadlineRow[]>(),
  ]);

  const deadlineLabel = (t?: string) => {
    const s = t ?? "internal";
    return `${s[0].toUpperCase()}${s.slice(1)} deadline`;
  };

  const items: AgendaItem[] = [
    ...(hearings ?? [])
      .filter((h) => h.due_date)
      .map((h): AgendaItem => ({
        key: `h-${h.id}`,
        date: h.due_date!,
        kind: "hearing",
        label: h.attributes?.purpose ?? "Hearing",
        matter: h.matter,
      })),
    ...(deadlines ?? [])
      .filter((d) => d.due_date)
      .map((d): AgendaItem => ({
        key: `d-${d.id}`,
        date: d.due_date!,
        kind: "deadline",
        label: d.attributes?.basis ?? deadlineLabel(d.attributes?.deadline_type),
        matter: d.matter,
      })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // Overdue is pinned first and loudest; the rest stays date-grouped & chronological.
  const overdueItems = items.filter((it) => isOverdue(it.date));
  const upcomingItems = items.filter((it) => !isOverdue(it.date));

  const groups = new Map<string, AgendaItem[]>();
  for (const it of upcomingItems) {
    if (!groups.has(it.date)) groups.set(it.date, []);
    groups.get(it.date)!.push(it);
  }

  const renderRow = (it: AgendaItem) => (
    <ListRow key={it.key} className="py-3 text-sm">
      {it.kind === "hearing" ? (
        <Landmark className="size-4 shrink-0 text-primary" />
      ) : (
        <AlarmClock className={cn("size-4 shrink-0", isOverdue(it.date) ? "text-urgent" : "text-lemon")} />
      )}
      <span className="min-w-0 flex-1 truncate">{it.label}</span>
      <span className={cn("tnum shrink-0 text-xs", isOverdue(it.date) ? "text-urgent" : "text-muted-foreground")}>
        {relativeDay(it.date)}
      </span>
      {it.matter && (
        <Link href={`/matters/${it.matter.id}`} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
          {it.matter.title}
        </Link>
      )}
    </ListRow>
  );

  return (
    <PageShell>
      <PageHeader title="Calendar" subtitle="Hearings and deadlines across all your matters.">
        <HelpLink anchor="calendar" label="Calendar" />
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nothing scheduled yet"
          description="Hearings and deadlines you add to a matter show up here, grouped by day — with anything overdue pinned to the top so it never slips."
        />
      ) : (
        <div className="space-y-6">
          {overdueItems.length > 0 && (
            <section>
              <div className="mb-2 flex items-baseline gap-2">
                <h2 className="font-serif text-base font-semibold tracking-tight text-urgent">Overdue</h2>
                <span className="tnum text-xs font-medium text-urgent">{overdueItems.length}</span>
              </div>
              <List tone="urgent">
                {overdueItems.map(renderRow)}
              </List>
            </section>
          )}

          {Array.from(groups.entries()).map(([date, dayItems]) => {
            const isTodayDate = isToday(date);
            return (
              <section key={date}>
                <div className="mb-2 flex items-baseline gap-2">
                  <h2 className="font-serif text-base font-semibold tracking-tight">{fmtDateYear(date)}</h2>
                  <span className={cn("text-xs", isTodayDate ? "font-medium text-urgent" : "text-muted-foreground")}>
                    {relativeDay(date)}
                  </span>
                </div>
                <List>{dayItems.map(renderRow)}</List>
              </section>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
