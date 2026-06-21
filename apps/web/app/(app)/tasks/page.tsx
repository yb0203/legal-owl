import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface ActionRow {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  state: { name: string; type: string } | null;
  matter: { id: string; title: string } | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-urgent",
  high: "text-urgent",
  medium: "text-foreground/70",
  low: "text-muted-foreground",
  none: "text-muted-foreground",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default async function ActionsPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("actions")
    .select("id, title, priority, due_date, completed_at, state:workflow_states(name, type), matter:matters(id, title)")
    .order("due_date", { ascending: true, nullsFirst: false })
    .returns<ActionRow[]>();

  const all = rows ?? [];
  const open = all.filter((a) => a.state?.type !== "completed" && a.state?.type !== "cancelled");
  const done = all.filter((a) => a.state?.type === "completed" || a.state?.type === "cancelled");

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Actions</h1>
      <p className="mt-1 text-sm text-muted-foreground">Everything you need to do across your matters.</p>

      {all.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No open actions.
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          <Group title="Open" actions={open} />
          {done.length > 0 && <Group title="Done" actions={done} muted />}
        </div>
      )}
    </main>
  );
}

function Group({ title, actions, muted }: { title: string; actions: ActionRow[]; muted?: boolean }) {
  if (actions.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-medium text-muted-foreground">
        {title} <span className="tnum">({actions.length})</span>
      </h2>
      <ul className="mt-3 divide-y overflow-hidden rounded-xl border">
        {actions.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 bg-card px-4 py-3 text-sm">
            <div className="min-w-0">
              <div className={muted ? "text-muted-foreground line-through" : ""}>{a.title}</div>
              {a.matter && (
                <Link
                  href={`/matters/${a.matter.id}`}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {a.matter.title}
                </Link>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3 text-xs">
              {!muted && a.priority !== "none" && (
                <span className={`font-medium capitalize ${PRIORITY_COLORS[a.priority] ?? ""}`}>
                  {a.priority}
                </span>
              )}
              {a.due_date && <span className="tnum text-muted-foreground">due {fmtDate(a.due_date)}</span>}
              {a.state && <span className="rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">{a.state.name}</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
