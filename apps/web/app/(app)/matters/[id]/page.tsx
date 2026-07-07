import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  FORUM_LABELS,
  FORUM_TYPES,
  MATTER_STATUSES,
  MATTER_STATUS_LABELS,
  type ForumType,
  type LifecycleState,
  type MatterStatus,
  type Parties,
  type WorkflowState,
} from "@/lib/types";
import { fmtDate, fmtDateYear } from "@/lib/format";
import { ForumBadge, HearingPill, MatterStatusBadge, SourceChip } from "@/components/badges";
import { EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatterStatusControl } from "@/components/matter/matter-status";
import { SyncNowButton } from "@/components/matter/sync-now-button";
import { EditDetailsDialog } from "@/components/matter/edit-details-dialog";
import { CopyChip } from "@/components/matter/copy-chip";
import { ConfirmDeleteDocument } from "@/components/matter/confirm-delete-document";
import { TaskList, type TaskRow } from "@/components/matter/task-list";
import { PropertiesRail, type PropertyRow } from "@/components/record/properties-rail";
import { RuleHint } from "@/components/record/rule-hint";
import { AttributeValue } from "@/components/record/attribute-value";
import { LabelPicker } from "@/components/label-picker";
import { PageShell, Panel, List, ListRow, Tag, BackLink } from "@/components/layout";
import { NativeSelect } from "@/components/native-select";
import { loadLabels } from "@/app/(app)/labels/actions";
import type { Label, ActivityRow, EventSource, TaskAttributes } from "@/lib/types";

interface HearingTaskRow {
  id: string;
  due_date: string | null;
  business_on_date: string | null;
  attributes: TaskAttributes;
}
interface DeadlineTaskRow {
  id: string;
  due_date: string | null;
  attributes: TaskAttributes;
}
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
  hearing_date_changed: "Next hearing",
  status_changed: "Status",
  hearing_held: "Hearing",
  judge_changed: "Judge changed",
  cause_list_entry: "Listed in cause list",
  document_added: "Document added",
  document_removed: "Document removed",
};

const DEADLINE_LABELS: Record<string, string> = {
  limitation: "Limitation",
  statutory: "Statutory",
  internal: "Internal",
};

const LIFECYCLE_LABELS: Record<LifecycleState, string> = {
  pending_first_sync: "Pending first sync",
  active: "Active",
  not_found: "Not found",
  disposed: "Disposed",
};
const LIFECYCLE_STATES = Object.keys(LIFECYCLE_LABELS) as LifecycleState[];

interface MatterDetail {
  id: string;
  key: string;
  cnr: string | null;
  forum_type: ForumType;
  title: string;
  parties: Parties & {
    petitioner_advocates?: string[];
    respondent_advocates?: string[];
  };
  case_type: string | null;
  court_status: string | null;
  court_name: string | null;
  matter_status: MatterStatus;
  lifecycle_state: LifecycleState;
  last_successful_sync_at: string | null;
  next_hearing_date: string | null;
  filing_date: string | null;
  registration_number: string | null;
  disposal_type: string | null;
  judges: string[] | null;
  petitioner_advocates: string[] | null;
  respondent_advocates: string[] | null;
  connected_cnrs: string[] | null;
  state: string | null;
  archived_at: string | null;
  client: { id: string; display_name: string } | null;
}

export default async function MatterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: matterRow } = await supabase
    .from("matters")
    .select(
      "id, key, cnr, forum_type, title, parties, case_type, court_status, court_name, matter_status, lifecycle_state, last_successful_sync_at, next_hearing_date, filing_date, registration_number, disposal_type, judges, petitioner_advocates, respondent_advocates, connected_cnrs, state, archived_at, client:clients(id, display_name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!matterRow) notFound();
  const matter = matterRow as unknown as MatterDetail;

  const [
    { data: activityRows },
    { data: tasks },
    { data: hearings },
    { data: deadlines },
    { data: documents },
    { data: states },
    { data: matterLabels },
    allLabels,
  ] = await Promise.all([
    supabase.from("activity").select("id, kind, event_type, body, new_value, source, occurred_at, created_at").eq("matter_id", id).order("occurred_at", { ascending: false }).returns<ActivityRow[]>(),
    supabase.from("tasks").select("id, title, priority, due_date, completed_at, state_id, state:workflow_states(name, type)").eq("matter_id", id).eq("type", "task").order("created_at", { ascending: true }).returns<TaskRow[]>(),
    supabase.from("tasks").select("id, due_date, business_on_date, attributes").eq("matter_id", id).eq("type", "hearing").order("due_date", { ascending: false }).returns<HearingTaskRow[]>(),
    supabase.from("tasks").select("id, due_date, attributes").eq("matter_id", id).eq("type", "deadline").order("due_date", { ascending: true }).returns<DeadlineTaskRow[]>(),
    supabase.from("documents").select("id, name, source, uploaded_at, storage_path, ecourts_order_date, ecourts_order_type, ocr_status").eq("matter_id", id).order("uploaded_at", { ascending: false }),
    supabase.from("workflow_states").select("id, name, type, position").is("lawyer_id", null).order("position").returns<WorkflowState[]>(),
    supabase.from("taggings").select("label:labels(id, name, color)").eq("target_type", "matter").eq("target_id", id).returns<{ label: Label | null }[]>(),
    loadLabels(),
  ]);

  const matterLabelList: Label[] = (matterLabels ?? []).map((r) => r.label).filter((l): l is Label => !!l);

  // Per-task label assignments, for chips + filtering on the Tasks tab.
  const taskIds = (tasks ?? []).map((t) => t.id);
  const { data: taskLabelRows } = taskIds.length
    ? await supabase
        .from("taggings")
        .select("target_id, label:labels(id, name, color)")
        .eq("target_type", "task")
        .in("target_id", taskIds)
        .returns<{ target_id: string; label: Label | null }[]>()
    : { data: [] as { target_id: string; label: Label | null }[] };
  const taskLabels: Record<string, Label[]> = {};
  for (const r of taskLabelRows ?? []) {
    if (r.label) (taskLabels[r.target_id] ??= []).push(r.label);
  }

  // Single immutable timeline (court events + remarks merged at the source).
  type TL = { kind: "event" | "remark"; key: string; at: string; label: string; source: EventSource; body?: string };
  const timeline: TL[] = (activityRows ?? []).map((a): TL =>
    a.kind === "remark"
      ? {
          kind: "remark",
          key: `r-${a.id}`,
          at: a.occurred_at ?? a.created_at,
          label: "Remark",
          source: a.source,
          body: a.body ?? "",
        }
      : {
          kind: "event",
          key: `e-${a.id}`,
          at: a.occurred_at ?? a.created_at,
          label: (EVENT_LABELS[a.event_type ?? ""] ?? a.event_type ?? "Update") + (a.new_value ? `: ${a.new_value}` : ""),
          source: a.source,
        },
  );

  const parties = matter.parties ?? {};
  const petitioners = parties.petitioners ?? [];
  const respondents = parties.respondents ?? [];
  const petitionerAdvocates = matter.petitioner_advocates ?? [];
  const respondentAdvocates = matter.respondent_advocates ?? [];
  const judges = matter.judges ?? [];
  const connectedCnrs = matter.connected_cnrs ?? [];
  const openTasks = (tasks ?? []).filter((t) => !t.completed_at).length;

  const factRows: PropertyRow[] = [
    // ── Identity ───────────────────────────────────────────────────────────
    { label: "Matter ID", value: <CopyChip value={matter.key} label="Matter ID" /> },
    { label: "CNR", value: matter.cnr ? <CopyChip value={matter.cnr} label="CNR" /> : null },
    { label: "Reg. number", value: matter.registration_number },
    { label: "Filed on", value: matter.filing_date ? <span className="tnum">{fmtDate(matter.filing_date)}</span> : null },

    // ── Court ──────────────────────────────────────────────────────────────
    { label: "Forum", value: <AttributeValue value={<ForumBadge forum={matter.forum_type} />} domain={FORUM_TYPES.map((f) => FORUM_LABELS[f])} /> },
    { label: "Court", value: matter.court_name },
    { label: "State", value: matter.state },
    { label: "Case type", value: matter.case_type },
    {
      label: "Court status",
      value: matter.court_status,
      hint: <RuleHint>From eCourts (read-only)</RuleHint>,
    },
    {
      label: "Lifecycle",
      value: <AttributeValue value={LIFECYCLE_LABELS[matter.lifecycle_state]} domain={LIFECYCLE_STATES.map((s) => LIFECYCLE_LABELS[s])} />,
      hint: <RuleHint>Sync state</RuleHint>,
    },
    ...(matter.disposal_type ? [{ label: "Disposal", value: matter.disposal_type }] : []),

    // ── Parties ────────────────────────────────────────────────────────────
    ...(petitioners.length > 0 ? [{
      label: "Petitioners",
      value: (
        <span className="flex flex-col gap-0.5">
          {petitioners.map((p, i) => <span key={i}>{p}</span>)}
        </span>
      ),
    }] : []),
    ...(respondents.length > 0 ? [{
      label: "Respondents",
      value: (
        <span className="flex flex-col gap-0.5">
          {respondents.map((r, i) => <span key={i}>{r}</span>)}
        </span>
      ),
    }] : []),
    ...(petitionerAdvocates.length > 0 ? [{
      label: "Pet. advocates",
      value: <span className="flex flex-col gap-0.5">{petitionerAdvocates.map((a, i) => <span key={i}>{a}</span>)}</span>,
    }] : []),
    ...(respondentAdvocates.length > 0 ? [{
      label: "Res. advocates",
      value: <span className="flex flex-col gap-0.5">{respondentAdvocates.map((a, i) => <span key={i}>{a}</span>)}</span>,
    }] : []),
    ...(judges.length > 0 ? [{
      label: "Bench",
      value: <span className="flex flex-col gap-0.5">{judges.map((j, i) => <span key={i}>{j}</span>)}</span>,
    }] : []),

    // ── Workflow ───────────────────────────────────────────────────────────
    {
      label: "Status",
      value: <AttributeValue value={<MatterStatusBadge status={matter.matter_status} />} domain={MATTER_STATUSES.map((s) => MATTER_STATUS_LABELS[s])} />,
    },
    {
      label: "Next hearing",
      value: matter.next_hearing_date ? <HearingPill date={matter.next_hearing_date} /> : null,
      hint: <RuleHint>Earliest scheduled hearing</RuleHint>,
    },
    {
      label: "Last synced",
      value: matter.last_successful_sync_at ? <span className="tnum">{fmtDateYear(matter.last_successful_sync_at)}</span> : null,
    },

    // ── Relations ──────────────────────────────────────────────────────────
    {
      label: "Client",
      value: matter.client ? (
        <Link href={`/clients/${matter.client.id}`} className="text-foreground hover:underline">
          {matter.client.display_name}
        </Link>
      ) : null,
    },
    ...(connectedCnrs.length > 0 ? [{
      label: "Tagged cases",
      value: (
        <span className="flex flex-col gap-0.5">
          {connectedCnrs.map((cnr, i) => <span key={i} className="font-mono text-xs">{cnr}</span>)}
        </span>
      ),
    }] : []),

    // ── Activity summary + labels ──────────────────────────────────────────
    {
      label: "Activity",
      value: (
        <span className="tnum text-muted-foreground">
          {hearings?.length ?? 0} hearings · {deadlines?.length ?? 0} deadlines · {documents?.length ?? 0} documents · {openTasks} open task{openTasks === 1 ? "" : "s"}
        </span>
      ),
    },
    {
      label: "Labels",
      value: <LabelPicker kind="matter" entityId={matter.id} assigned={matterLabelList} available={allLabels} />,
    },
  ];

  return (
    <PageShell>
      <BackLink href="/matters">Matters</BackLink>

      <div className="mt-3 space-y-6">
        {/* Facts / properties card — the matter as one legible object. */}
        <aside>
          <Panel className="p-5">
            <div className="flex items-start justify-between gap-3">
              <h1 className="min-w-0 font-serif text-xl font-semibold tracking-tight">{matter.title}</h1>
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

            <PropertiesRail items={factRows} className="mt-3" />

            <div className="mt-4 border-t pt-4">
              <div className="mb-2 text-xs text-muted-foreground">Actions</div>
              <div className="flex flex-wrap items-center gap-2">
                <MatterStatusControl matterId={matter.id} status={matter.matter_status} archived={!!matter.archived_at} />
                <SyncNowButton matterId={matter.id} hasCnr={!!matter.cnr} />
              </div>
            </div>
          </Panel>
        </aside>

      <Tabs defaultValue="timeline" className="min-w-0">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="tasks">Tasks {openTasks > 0 && <span className="tnum ml-1 text-muted-foreground">{openTasks}</span>}</TabsTrigger>
          <TabsTrigger value="hearings">Hearings</TabsTrigger>
          <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* Timeline */}
        <TabsContent value="timeline" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <RuleHint>Append-only — court events &amp; remarks are never edited or deleted</RuleHint>
          </div>
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
          <TaskList matterId={id} tasks={tasks ?? []} states={states ?? []} taskLabels={taskLabels} allLabels={allLabels} />
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
                      <div className="truncate font-medium">{h.attributes?.purpose ?? "Hearing"}</div>
                      {h.attributes?.outcome && <div className="text-xs text-muted-foreground">{h.attributes.outcome}</div>}
                      {h.business_on_date && <div className="text-xs text-muted-foreground">Business on: {fmtDate(h.business_on_date)}</div>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tnum text-sm font-semibold">{h.due_date ? fmtDate(h.due_date) : "—"}</span>
                      <Tag className="capitalize">{h.attributes?.court_state ?? "scheduled"}</Tag>
                    </div>
                  </div>
                  {(h.attributes?.court_state ?? "scheduled") === "scheduled" && (
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
            <NativeSelect name="type" aria-label="Deadline type" defaultValue="internal" className="h-9 w-auto px-2.5">
              <option value="internal">Internal</option>
              <option value="statutory">Statutory</option>
              <option value="limitation">Limitation</option>
            </NativeSelect>
            <Input name="basis" placeholder="Basis (optional)" className="min-w-40 flex-1" />
            <Button type="submit" size="sm">Add deadline</Button>
          </form>
          {(deadlines?.length ?? 0) === 0 ? (
            <EmptyState title="No deadlines" hint="Statutory and limitation dates are computed by rule, never guessed." />
          ) : (
            <List>
              {deadlines!.map((d) => {
                const dtype = d.attributes?.deadline_type ?? "internal";
                return (
                  <ListRow key={d.id} className="justify-between text-sm">
                    <div>
                      <Tag>{DEADLINE_LABELS[dtype] ?? dtype}</Tag>
                      {d.attributes?.basis && <span className="ml-2 text-muted-foreground">{d.attributes.basis}</span>}
                    </div>
                    <span className="tnum shrink-0 text-sm font-medium">{d.due_date ? fmtDateYear(d.due_date) : "—"}</span>
                  </ListRow>
                );
              })}
            </List>
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
            <NativeSelect name="source" defaultValue="lawyer_upload" aria-label="Document type" className="h-9 w-auto px-2.5">
              <option value="lawyer_upload">Filing / upload</option>
              <option value="court_order">Court order</option>
              <option value="judgement">Judgement</option>
            </NativeSelect>
            <Button type="submit" size="sm">Upload</Button>
          </form>
          {(documents?.length ?? 0) === 0 ? (
            <EmptyState title="No documents yet" hint="Upload orders, judgements and filings to keep the file together." />
          ) : (
            <List>
              {documents!.map((d) => {
                const doc = d as typeof d & { ecourts_order_date?: string | null; ecourts_order_type?: string | null; ocr_status?: string | null };
                return (
                  <ListRow key={d.id} className="text-sm">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <form action={downloadDocument}>
                        <input type="hidden" name="storage_path" value={d.storage_path} />
                        <button type="submit" className="truncate text-left hover:underline">{d.name}</button>
                      </form>
                      {doc.ecourts_order_date && (
                        <div className="text-xs text-muted-foreground capitalize">
                          {doc.ecourts_order_type ?? "order"} · {fmtDate(doc.ecourts_order_date)}
                          {doc.ocr_status === "done" && <span className="ml-2 text-primary">· OCR ready</span>}
                        </div>
                      )}
                    </div>
                    <span className="tnum shrink-0 text-xs text-muted-foreground">{fmtDate(d.uploaded_at)}</span>
                    <ConfirmDeleteDocument docId={d.id} matterId={id} storagePath={d.storage_path} name={d.name} />
                  </ListRow>
                );
              })}
            </List>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </PageShell>
  );
}
