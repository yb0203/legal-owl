import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/page-header";
import { PageShell } from "@/components/layout";
import { HelpLink } from "@/components/help/help-link";
import { TriageRow, type TriageRowItem } from "@/components/inbox/triage-row";

interface Row {
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

export default async function InboxPage() {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: rows } = await supabase
    .from("triage_items")
    .select("id, kind, summary, created_at, matter:matters(id, title, key)")
    .eq("state", "pending")
    .or(`snoozed_until.is.null,snoozed_until.lte.${now}`)
    .order("created_at", { ascending: false })
    .returns<Row[]>();

  const items: TriageRowItem[] = (rows ?? []).map((r) => ({
    id: r.id,
    summary: r.summary,
    kindLabel: KIND_LABELS[r.kind] ?? r.kind,
    createdAt: r.created_at,
    matter: r.matter,
  }));

  return (
    <PageShell>
      <PageHeader
        title="Inbox"
        subtitle="Court updates waiting for your review — accept into a task, snooze, or dismiss."
      >
        <HelpLink anchor="triage" label="Inbox" />
      </PageHeader>
      {items.length === 0 ? (
        <EmptyState title="Inbox zero" hint="You're all caught up — nothing to review." />
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <TriageRow key={it.id} item={it} />
          ))}
        </ul>
      )}
    </PageShell>
  );
}
