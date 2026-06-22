import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  FORUM_LABELS,
  type ForumType,
  type MatterStatus,
  type Parties,
  type WorkflowState,
} from "@/lib/types";
import { fmtDate, fmtDateYear } from "@/lib/format";
import { ForumBadge, HearingPill, SourceChip } from "@/components/badges";
import { EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatterStatusControl } from "@/components/matter/matter-status";
import { EditDetailsDialog } from "@/components/matter/edit-details-dialog";
import { CopyChip } from "@/components/matter/copy-chip";
import { ConfirmDeleteDocument } from "@/components/matter/confirm-delete-document";
import { TaskList, type TaskRow } from "@/components/matter/task-list";
import {
  addRemark,
  addHearing,
  setHearingOutcome,
  addDeadline,
  uploadDocument,
  downloadDocument,
} from "./actions";

const EVENT_LABELS: Record<string, string> = {
  order_uploaded: "Order uploaded",
  hearing_date_changed: "Hearing date changed",
  status_changed: "Status changed",
  judge_changed: "Judge changed",
  document_added: "Document added",
  document_removed: "Document removed",
};

const DEADLINE_LABELS: Record<string, string> = {
  limitation: "Limitation",
  statutory: "Statutory",
  internal: "Internal",
};

interface MatterDetail {
  id: string;
  key: string;
  cnr: string | null;
  forum_type: ForumType;
  title: string;
  parties: Parties;
  case_type: string | null;
  court_status: string | null;
  matter_status: MatterStatus;
  next_hearing_date: string | null;
  archived_at: string | null;
  client: { id: string; display_name: string } | null;
  engagement: { id: string; name: string } | null;
}

export default async function MatterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: matterRow } = await supabase
    .from("matters")
    .select(
      "id, key, cnr, forum_type, title, parties, case_type, court_status, matter_status, next_hearing_date, archived_at, client:clients(id, display_name), engagement:engagements(id, name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!matterRow) notFound();
  const matter = matterRow as unknown as MatterDetail;

  const [
    { data: events },
    { data: remarks },
    { data: tasks },
    { data: hearings },
    { data: deadlines },
    { data: documents },
    { data: states },
  ] = await Promise.all([
    supabase.from("court_events").select("id, event_type, new_value, occurred_at, detected_at, source_type").eq("matter_id", id),
    supabase.from("remarks").select("id, body, created_at").eq("matter_id", id),
    supabase.from("actions").select("id, title, priority, due_date, completed_at, state_id, state:workflow_states(name, type)").eq("matter_id", id).order("created_at", { ascending: true }).returns<TaskRow[]>(),
    supabase.from("hearings").select("id, hearing_date, purpose, outcome, state").eq("matter_id", id).order("hearing_date", { ascending: false }),
    supabase.from("deadlines").select("id, type, due_date, basis").eq("matter_id", id).order("due_date", { ascending: true }),
    supabase.from("documents").select("id, name, source, uploaded_at, storage_path").eq("matter_id", id).order("uploaded_at", { ascending: false }),
    supabase.from("workflow_states").select("id, name, type, position").is("lawyer_id", null).order("position").returns<WorkflowState[]>(),
  ]);

  type TL = { kind: "event" | "remark"; key: string; at: string; label: string; source: "ecourt" | "lawyer_manual" | "system"; body?: string };
  const timeline: TL[] = [
    ...(events ?? []).map((e): TL => ({
      kind: "event",
      key: `e-${e.id}`,
      at: e.occurred_at ?? e.detected_at,
      label: (EVENT_LABELS[e.event_type] ?? e.event_type) + (e.new_value ? `: ${e.new_value}` : ""),
      source: e.source_type,
    })),
    ...(remarks ?? []).map((r): TL => ({
      kind: "remark",
      key: `r-${r.id}`,
      at: r.created_at,
      label: "Remark",
      source: "lawyer_manual",
      body: r.body,
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  const parties = matter.parties ?? {};
  const openTasks = (tasks ?? []).filter((t) => !t.completed_at).length;

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <Link href="/matters" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> Matters
      </Link>

      {/* Pinned case header */}
      <header className="mt-3 rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-serif text-2xl font-semibold tracking-tight">{matter.title}</h1>
            {(parties.petitioners?.length || parties.respondents?.length) && (
              <p className="mt-1 text-sm text-muted-foreground">
                {(parties.petitioners ?? []).join(", ")}{" "}
                <span className="text-muted-foreground/60">v.</span>{" "}
                {(parties.respondents ?? []).join(", ")}
              </p>
            )}
          </div>
          <EditDetailsDialog
            matter={{
              id: matter.id,
              title: matter.title,
              case_type: matter.case_type,
              forum_type: matter.forum_type,
              cnr: matter.cnr,
              parties,
            }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <ForumBadge forum={matter.forum_type} />
          {matter.case_type && <span className="text-muted-foreground">{matter.case_type}</span>}
          <CopyChip value={matter.key} label="Matter id" />
          {matter.cnr && <CopyChip value={matter.cnr} label="CNR" />}
          {matter.client && (
            <Link href={`/clients/${matter.client.id}`} className="text-muted-foreground hover:text-foreground">
              {matter.client.display_name}
              {matter.engagement && matter.engagement.name !== "General" ? ` · ${matter.engagement.name}` : ""}
            </Link>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div>
            <div className="text-xs text-muted-foreground">Next hearing</div>
            <div className="mt-0.5">
              <HearingPill date={matter.next_hearing_date} />
            </div>
          </div>
          <MatterStatusControl matterId={matter.id} status={matter.matter_status} archived={!!matter.archived_at} />
        </div>
      </header>

      <Tabs defaultValue="timeline" className="mt-6">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="tasks">Tasks {openTasks > 0 && <span className="tnum ml-1 text-muted-foreground">{openTasks}</span>}</TabsTrigger>
          <TabsTrigger value="hearings">Hearings</TabsTrigger>
          <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* Timeline */}
        <TabsContent value="timeline" className="mt-4 space-y-4">
          <form action={addRemark} className="flex items-end gap-2">
            <input type="hidden" name="matter_id" value={id} />
            <Textarea name="body" rows={1} required placeholder="Add a remark…" className="min-h-10 resize-none" />
            <Button type="submit" size="sm">Add</Button>
          </form>
          <ol className="space-y-2.5">
            {timeline.length === 0 && <EmptyState title="No activity yet" hint="Court updates and your remarks will appear here." />}
            {timeline.map((it) =>
              it.kind === "remark" ? (
                <li key={it.key} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <SourceChip source={it.source} />
                    <span className="tnum">{fmtDate(it.at)}</span>
                  </div>
                  <p className="mt-1.5 text-sm">{it.body}</p>
                </li>
              ) : (
                <li key={it.key} className="flex items-center gap-3 px-1 py-1 text-sm">
                  <SourceChip source={it.source} />
                  <span className="flex-1 text-foreground/90">{it.label}</span>
                  <span className="tnum shrink-0 text-xs text-muted-foreground">{fmtDate(it.at)}</span>
                </li>
              ),
            )}
          </ol>
        </TabsContent>

        {/* Tasks */}
        <TabsContent value="tasks" className="mt-4">
          <TaskList matterId={id} tasks={tasks ?? []} states={states ?? []} />
        </TabsContent>

        {/* Hearings */}
        <TabsContent value="hearings" className="mt-4 space-y-4">
          <form action={addHearing} className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3">
            <input type="hidden" name="matter_id" value={id} />
            <Input name="hearing_date" type="date" required aria-label="Hearing date" className="w-40" />
            <Input name="purpose" placeholder="Purpose (e.g. Arguments)" className="min-w-48 flex-1" />
            <Button type="submit" size="sm">Add hearing</Button>
          </form>
          {(hearings?.length ?? 0) === 0 ? (
            <EmptyState title="No hearings on record" />
          ) : (
            <ul className="space-y-2">
              {hearings!.map((h) => (
                <li key={h.id} className="rounded-lg border bg-card px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{h.purpose ?? "Hearing"}</div>
                      {h.outcome && <div className="text-xs text-muted-foreground">{h.outcome}</div>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tnum text-sm font-semibold">{fmtDate(h.hearing_date)}</span>
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] capitalize text-secondary-foreground">{h.state}</span>
                    </div>
                  </div>
                  {h.state === "scheduled" && (
                    <form action={setHearingOutcome} className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2">
                      <input type="hidden" name="hearing_id" value={h.id} />
                      <input type="hidden" name="matter_id" value={id} />
                      <select name="state" aria-label="Outcome state" defaultValue="held" className="h-7 rounded-md border border-input bg-transparent px-1.5 text-xs outline-none">
                        <option value="held">Held</option>
                        <option value="adjourned">Adjourned</option>
                      </select>
                      <Input name="outcome" placeholder="Outcome / next step" className="h-7 min-w-40 flex-1 text-xs" />
                      <Button type="submit" size="sm" variant="outline">Record</Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* Deadlines */}
        <TabsContent value="deadlines" className="mt-4 space-y-4">
          <form action={addDeadline} className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3">
            <input type="hidden" name="matter_id" value={id} />
            <Input name="due_date" type="date" required aria-label="Due date" className="w-40" />
            <select name="type" aria-label="Deadline type" defaultValue="internal" className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none">
              <option value="internal">Internal</option>
              <option value="statutory">Statutory</option>
              <option value="limitation">Limitation</option>
            </select>
            <Input name="basis" placeholder="Basis (optional)" className="min-w-40 flex-1" />
            <Button type="submit" size="sm">Add deadline</Button>
          </form>
          {(deadlines?.length ?? 0) === 0 ? (
            <EmptyState title="No deadlines" hint="Statutory and limitation dates are computed by rule, never guessed." />
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border">
              {deadlines!.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 bg-card px-4 py-3 text-sm">
                  <div>
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">{DEADLINE_LABELS[d.type] ?? d.type}</span>
                    {d.basis && <span className="ml-2 text-muted-foreground">{d.basis}</span>}
                  </div>
                  <span className="tnum shrink-0 text-sm font-medium">{fmtDateYear(d.due_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents" className="mt-4 space-y-4">
          <form action={uploadDocument} className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
            <input type="hidden" name="matter_id" value={id} />
            <input
              name="file"
              type="file"
              required
              className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            <select name="source" defaultValue="lawyer_upload" aria-label="Document type" className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none">
              <option value="lawyer_upload">Filing / upload</option>
              <option value="court_order">Court order</option>
              <option value="judgement">Judgement</option>
            </select>
            <Button type="submit" size="sm">Upload</Button>
          </form>
          {(documents?.length ?? 0) === 0 ? (
            <EmptyState title="No documents yet" hint="Upload orders, judgements and filings to keep the file together." />
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border">
              {documents!.map((d) => (
                <li key={d.id} className="flex items-center gap-3 bg-card px-4 py-3 text-sm">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <form action={downloadDocument} className="min-w-0 flex-1">
                    <input type="hidden" name="storage_path" value={d.storage_path} />
                    <button type="submit" className="truncate text-left hover:underline">{d.name}</button>
                  </form>
                  <span className="tnum shrink-0 text-xs text-muted-foreground">{fmtDate(d.uploaded_at)}</span>
                  <ConfirmDeleteDocument docId={d.id} matterId={id} storagePath={d.storage_path} name={d.name} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}
