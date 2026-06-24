import { createClient } from "@/lib/supabase/server";
import { getSystemStateId } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/page-header";
import { PageShell } from "@/components/layout";
import { HelpLink } from "@/components/help/help-link";
import { TriageRow, type TriageRowItem } from "@/components/inbox/triage-row";
import type { TaskAttributes } from "@/lib/types";

interface Row {
  id: string;
  title: string;
  attributes: TaskAttributes;
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
  const triageId = await getSystemStateId(supabase, "Triage");

  // Inbox = type='task' rows parked in the Triage state (minus snoozed).
  const { data: rows } = await supabase
    .from("tasks")
    .select("id, title, attributes, created_at, matter:matters(id, title, key)")
    .eq("type", "task")
    .eq("state_id", triageId ?? "")
    .or(`snoozed_until.is.null,snoozed_until.lte.${now}`)
    .order("created_at", { ascending: false })
    .returns<Row[]>();

  const items: TriageRowItem[] = (rows ?? []).map((r) => {
    const kind = r.attributes?.triage_kind ?? "";
    return {
      id: r.id,
      summary: r.title,
      kindLabel: KIND_LABELS[kind] ?? kind ?? "Update",
      createdAt: r.created_at,
      matter: r.matter,
    };
  });

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
