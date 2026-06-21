import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { acceptTriageItem, dismissTriageItem } from "./actions";

interface TriageRow {
  id: string;
  kind: string;
  summary: string;
  created_at: string;
  matter: { id: string; title: string; key: string } | null;
}

const KIND_LABELS: Record<string, string> = {
  order_uploaded: "New order",
  hearing_date_changed: "Hearing date",
  status_changed: "Status change",
};

export default async function TriagePage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("triage_items")
    .select("id, kind, summary, created_at, matter:matters(id, title, key)")
    .eq("state", "pending")
    .order("created_at", { ascending: false })
    .returns<TriageRow[]>();

  const items = rows ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Triage</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Court updates waiting for your review — accept into an action or dismiss to the record.
      </p>

      {items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          All caught up — nothing to triage.
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((it) => (
            <li key={it.id} className="rounded-xl border bg-card p-4">
              <div className="min-w-0">
                <span className="rounded bg-lemon/15 px-1.5 py-0.5 text-[11px] font-medium text-foreground/80">
                  {KIND_LABELS[it.kind] ?? it.kind}
                </span>
                <p className="mt-1.5 text-sm font-medium">{it.summary}</p>
                {it.matter && (
                  <Link
                    href={`/matters/${it.matter.id}`}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {it.matter.title} · <span className="font-mono tnum">{it.matter.key}</span>
                  </Link>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <form action={acceptTriageItem}>
                  <input type="hidden" name="item_id" value={it.id} />
                  <Button type="submit" size="sm">
                    Accept as action
                  </Button>
                </form>
                <form action={dismissTriageItem}>
                  <input type="hidden" name="item_id" value={it.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Dismiss
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
