import Link from "next/link";
import { Landmark, AlarmClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/page-header";
import { fmtDateYear, relativeDay, isToday, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";

interface HearingRow {
  id: string;
  hearing_date: string;
  purpose: string | null;
  matter: { id: string; title: string } | null;
}
interface DeadlineRow {
  id: string;
  due_date: string;
  type: string;
  basis: string | null;
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
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: hearings }, { data: deadlines }] = await Promise.all([
    supabase
      .from("hearings")
      .select("id, hearing_date, purpose, matter:matters(id, title)")
      .eq("state", "scheduled")
      .gte("hearing_date", today)
      .order("hearing_date", { ascending: true })
      .returns<HearingRow[]>(),
    supabase
      .from("deadlines")
      .select("id, due_date, type, basis, matter:matters(id, title)")
      .gte("due_date", today)
      .order("due_date", { ascending: true })
      .returns<DeadlineRow[]>(),
  ]);

  const items: AgendaItem[] = [
    ...(hearings ?? []).map((h): AgendaItem => ({
      key: `h-${h.id}`,
      date: h.hearing_date,
      kind: "hearing",
      label: h.purpose ?? "Hearing",
      matter: h.matter,
    })),
    ...(deadlines ?? []).map((d): AgendaItem => ({
      key: `d-${d.id}`,
      date: d.due_date,
      kind: "deadline",
      label: d.basis ?? `${d.type[0].toUpperCase()}${d.type.slice(1)} deadline`,
      matter: d.matter,
    })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // Group by date, preserving chronological order.
  const groups = new Map<string, AgendaItem[]>();
  for (const it of items) {
    if (!groups.has(it.date)) groups.set(it.date, []);
    groups.get(it.date)!.push(it);
  }

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <PageHeader title="Calendar" subtitle="Upcoming hearings and deadlines across all your matters." />

      {groups.size === 0 ? (
        <EmptyState title="Nothing scheduled" hint="Hearings and deadlines you add to matters will appear here." />
      ) : (
        <div className="space-y-6">
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
                <ul className="divide-y overflow-hidden rounded-xl border">
                  {dayItems.map((it) => (
                    <li key={it.key} className="flex items-center gap-3 bg-card px-4 py-3 text-sm">
                      {it.kind === "hearing" ? (
                        <Landmark className="size-4 shrink-0 text-primary" />
                      ) : (
                        <AlarmClock className={cn("size-4 shrink-0", isOverdue(it.date) ? "text-urgent" : "text-lemon")} />
                      )}
                      <span className="min-w-0 flex-1 truncate">{it.label}</span>
                      {it.matter && (
                        <Link href={`/matters/${it.matter.id}`} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
                          {it.matter.title}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
