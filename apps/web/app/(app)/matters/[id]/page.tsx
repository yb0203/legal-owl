import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Landmark, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FORUM_LABELS, type ForumType, type MatterStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addRemark } from "./actions";

interface MatterDetail {
  id: string;
  key: string;
  cnr: string | null;
  forum_type: ForumType;
  title: string;
  parties: { petitioners?: string[]; respondents?: string[] };
  case_type: string | null;
  court_status: string | null;
  matter_status: MatterStatus;
  next_hearing_date: string | null;
}
interface CourtEvent {
  id: string;
  event_type: string;
  new_value: string | null;
  occurred_at: string | null;
  detected_at: string;
}
interface Remark {
  id: string;
  body: string;
  created_at: string;
}
interface Action {
  id: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
  priority: string;
}
interface Hearing {
  id: string;
  hearing_date: string;
  purpose: string | null;
  outcome: string | null;
  state: string;
}

type TimelineItem =
  | { kind: "event"; key: string; at: string; ev: CourtEvent }
  | { kind: "remark"; key: string; at: string; rm: Remark };

const EVENT_LABELS: Record<string, string> = {
  order_uploaded: "Order uploaded",
  hearing_date_changed: "Hearing date changed",
  status_changed: "Status changed",
  judge_changed: "Judge changed",
};

function fmtDate(d?: string | null) {
  return d
    ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
}

export default async function MatterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: matterRow } = await supabase
    .from("matters")
    .select("id, key, cnr, forum_type, title, parties, case_type, court_status, matter_status, next_hearing_date")
    .eq("id", id)
    .maybeSingle();
  if (!matterRow) notFound();
  const matter = matterRow as MatterDetail;

  const [{ data: events }, { data: remarks }, { data: actions }, { data: hearings }] = await Promise.all([
    supabase
      .from("court_events")
      .select("id, event_type, new_value, occurred_at, detected_at")
      .eq("matter_id", id)
      .returns<CourtEvent[]>(),
    supabase.from("remarks").select("id, body, created_at").eq("matter_id", id).returns<Remark[]>(),
    supabase
      .from("actions")
      .select("id, title, due_date, completed_at, priority")
      .eq("matter_id", id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .returns<Action[]>(),
    supabase
      .from("hearings")
      .select("id, hearing_date, purpose, outcome, state")
      .eq("matter_id", id)
      .order("hearing_date", { ascending: false })
      .returns<Hearing[]>(),
  ]);

  const timeline: TimelineItem[] = [
    ...(events ?? []).map((ev): TimelineItem => ({
      kind: "event",
      key: `e-${ev.id}`,
      at: ev.occurred_at ?? ev.detected_at,
      ev,
    })),
    ...(remarks ?? []).map((rm): TimelineItem => ({
      kind: "remark",
      key: `r-${rm.id}`,
      at: rm.created_at,
      rm,
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  const parties = matter.parties ?? {};

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <Link
        href="/matters"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Matters
      </Link>

      <header className="mt-3 rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-serif text-2xl font-semibold tracking-tight">{matter.title}</h1>
          <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium capitalize text-secondary-foreground">
            {matter.matter_status}
          </span>
        </div>
        {(parties.petitioners?.length || parties.respondents?.length) && (
          <p className="mt-1 text-sm text-muted-foreground">
            {(parties.petitioners ?? []).join(", ")}{" "}
            <span className="text-muted-foreground/60">v.</span>{" "}
            {(parties.respondents ?? []).join(", ")}
          </p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Field label="Forum" value={FORUM_LABELS[matter.forum_type]} />
          <Field label="Case type" value={matter.case_type ?? "—"} />
          <Field label="Next hearing" value={fmtDate(matter.next_hearing_date)} strong />
          {matter.cnr && <Field label="CNR" value={matter.cnr} mono />}
        </dl>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">Timeline</h2>
        <form action={addRemark} className="mt-3 flex items-end gap-2">
          <input type="hidden" name="matter_id" value={id} />
          <Textarea
            name="body"
            rows={1}
            placeholder="Add a remark…"
            className="min-h-10 resize-none"
            required
          />
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>

        <ol className="mt-4 space-y-2.5">
          {timeline.length === 0 && <Empty>No activity yet.</Empty>}
          {timeline.map((it) =>
            it.kind === "remark" ? (
              <li key={it.key} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquare className="size-3.5" /> Your remark
                  </span>
                  <span className="tnum">{fmtDate(it.at)}</span>
                </div>
                <p className="mt-1.5 text-sm">{it.rm.body}</p>
              </li>
            ) : (
              <li key={it.key} className="flex items-center gap-3 px-1 py-1 text-sm">
                <Landmark className="size-4 shrink-0 text-primary" />
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                  eCourts
                </span>
                <span className="flex-1 text-foreground/90">
                  {EVENT_LABELS[it.ev.event_type] ?? it.ev.event_type}
                  {it.ev.new_value ? `: ${it.ev.new_value}` : ""}
                </span>
                <span className="tnum shrink-0 text-xs text-muted-foreground">{fmtDate(it.at)}</span>
              </li>
            ),
          )}
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">Actions</h2>
        {(actions?.length ?? 0) === 0 ? (
          <Empty>No actions yet.</Empty>
        ) : (
          <ul className="mt-3 divide-y overflow-hidden rounded-xl border">
            {actions!.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 bg-card px-4 py-3 text-sm">
                <span className={a.completed_at ? "text-muted-foreground line-through" : ""}>
                  {a.title}
                </span>
                {a.due_date && (
                  <span className="tnum shrink-0 text-xs text-muted-foreground">
                    due {fmtDate(a.due_date)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">Hearings</h2>
        {(hearings?.length ?? 0) === 0 ? (
          <Empty>No hearings on record.</Empty>
        ) : (
          <ul className="mt-3 divide-y overflow-hidden rounded-xl border">
            {hearings!.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 bg-card px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate">{h.purpose ?? "Hearing"}</div>
                  {h.outcome && <div className="text-xs text-muted-foreground">{h.outcome}</div>}
                </div>
                <span className="tnum shrink-0 text-xs font-medium">{fmtDate(h.hearing_date)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  strong,
  mono,
}: {
  label: string;
  value: string;
  strong?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 ${strong ? "font-semibold" : ""} ${mono ? "font-mono tnum text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
