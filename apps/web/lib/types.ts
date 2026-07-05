// Domain types for Case Workflow — mirrors supabase/migrations/20260621000001_case_workflow.sql

export const FORUM_TYPES = [
  "district",
  "high_court",
  "supreme_court",
  "nclt",
  "nclat",
  "arbitration",
  "tribunal",
  "other",
] as const;

export type ForumType = (typeof FORUM_TYPES)[number];

export const FORUM_LABELS: Record<ForumType, string> = {
  district: "District Court",
  high_court: "High Court",
  supreme_court: "Supreme Court",
  nclt: "NCLT",
  nclat: "NCLAT",
  arbitration: "Arbitration",
  tribunal: "Tribunal",
  other: "Other",
};

export const MATTER_STATUSES = ["active", "on_hold", "disposed"] as const;
export type MatterStatus = (typeof MATTER_STATUSES)[number];

export const MATTER_STATUS_LABELS: Record<MatterStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  disposed: "Disposed",
};

export type LifecycleState =
  | "pending_first_sync"
  | "active"
  | "not_found"
  | "disposed";

export interface Parties {
  petitioners?: string[];
  respondents?: string[];
  advocates?: string[];
}

export interface Matter {
  id: string;
  key: string;
  cnr: string | null;
  forum_type: ForumType;
  title: string;
  court_status: string | null;
  matter_status: MatterStatus;
  lifecycle_state: LifecycleState;
  next_hearing_date: string | null;
  created_at: string;
}

// ── Workflow status (Linear-style: the type drives the board, not the name) ──
export const STATE_TYPES = [
  "triage",
  "unstarted",
  "started",
  "blocked",
  "completed",
  "cancelled",
] as const;
export type StateType = (typeof STATE_TYPES)[number];

export const STATE_TYPE_LABELS: Record<StateType, string> = {
  triage: "Awaiting review",
  unstarted: "Pending",
  started: "In progress",
  blocked: "Blocked",
  completed: "Done",
  cancelled: "Dropped",
};

export interface WorkflowState {
  id: string;
  name: string;
  type: StateType;
  position: number;
}

export const PRIORITIES = ["none", "low", "medium", "high", "urgent"] as const;
export type ActionPriority = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<ActionPriority, string> = {
  none: "No priority",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export type EventSource = "ecourt" | "lawyer_manual" | "system";
export type HearingStateType = "scheduled" | "held" | "adjourned";

// ── Task-first model ─────────────────────────────────────────────────────────
// One base entity (`tasks`) unifies the old actions/hearings/deadlines/triage.
// `type` selects the flavour; type-specific legal fields live in `attributes`.
export const TASK_TYPES = ["task", "hearing", "deadline"] as const;
export type TaskType = (typeof TASK_TYPES)[number];
export type TaskSource = "manual" | "triage" | "template" | "sync";

/** type='hearing' attributes. */
export interface HearingAttributes {
  purpose?: string | null;
  outcome?: string | null;
  court_state?: HearingStateType;
  ordinal?: number;
}
/** type='deadline' attributes. */
export interface DeadlineAttributes {
  basis?: string | null;
  deadline_type?: "limitation" | "statutory" | "internal";
}
/** type='task' parked in the Triage state (the Inbox). */
export interface TriageAttributes {
  triage_kind?: string;
}
export type TaskAttributes = HearingAttributes & DeadlineAttributes & TriageAttributes;

/** A raw `tasks` row (DB shape). Reads shape these into the DTOs below. */
export interface TaskRecord {
  id: string;
  lawyer_id: string;
  matter_id: string;
  type: TaskType;
  key: string | null;
  title: string;
  description: string | null;
  state_id: string | null;
  priority: ActionPriority;
  due_date: string | null;
  completed_at: string | null;
  source: TaskSource;
  parent_id: string | null;
  snoozed_until: string | null;
  attributes: TaskAttributes;
  created_at: string;
}

// ── Activity (immutable audit/timeline: court_events + remarks merged) ────────
export type ActivityKind = "court_event" | "remark" | "system";

export interface ActivityRow {
  id: string;
  kind: ActivityKind;
  event_type: string | null;
  body: string | null;
  previous_value: string | null;
  new_value: string | null;
  source: EventSource;
  occurred_at: string | null;
  created_at: string;
}

// ── Chat foundation (Vercel Chat SDK / AI SDK UIMessage) — no UI this pass ───
export type ConversationKind = "assistant" | "client";
export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface Conversation {
  id: string;
  matter_id: string | null;
  client_id: string | null;
  kind: ConversationKind;
  title: string | null;
  visibility: string;
  last_message_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  parts: unknown[];
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Clients & contacts ──────────────────────────────────────────────────────
export type ClientType = "individual" | "organisation";
export type ClientStatus = "lead" | "active" | "inactive";
export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  lead: "Lead",
  active: "Active",
  inactive: "Inactive",
};

export interface Client {
  id: string;
  type: ClientType;
  display_name: string;
  status: ClientStatus;
  email: string | null;
  phone: string | null;
  address: string | null;
  gstin: string | null;
  pan: string | null;
  notes: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  client_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
}

export type DocumentSource =
  | "court_order"
  | "judgement"
  | "lawyer_upload"
  | "generated";

export interface DocumentRow {
  id: string;
  matter_id: string;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  source: DocumentSource;
  uploaded_at: string;
}

export interface Label {
  id: string;
  name: string;
  color: string | null;
}

// ── Agent grounding layer: facts, acts/checks, citations, playbook ───────────
// Mirrors supabase/migrations/20260705000001_agent_grounding_layer.sql

// ── Facts (extracted, citeable facts with span provenance) ──────────────────
export const FACT_STATUSES = ["proposed", "verified"] as const;
export type FactStatus = (typeof FACT_STATUSES)[number];

/** Canonical typed payload stored in facts.value. */
export type FactValue =
  | { kind: "text"; text: string }
  | { kind: "number"; number: number; unit?: string }
  | { kind: "date"; date: string } // ISO yyyy-mm-dd
  | { kind: "money"; amount: number; currency: string } // currency 'INR' etc.
  | { kind: "boolean"; value: boolean };

/**
 * A raw `facts` row — self-citing: its own (document_id, start_offset,
 * end_offset) span IS the citation for this row (see lib/citations.ts
 * factToSpanRef). Downstream assertions cite a fact via a RecordRef instead
 * of re-deriving its span.
 */
export interface Fact {
  id: string;
  lawyer_id: string;
  matter_id: string;
  document_id: string;
  start_offset: number; // inclusive char offset into the document's extracted text
  end_offset: number; // exclusive
  fact_type: string; // open vocabulary: party_name, filing_date, claim_amount, ...
  value: FactValue;
  value_text: string; // denormalised, always-renderable display string
  confidence: number; // 0..1
  status: FactStatus;
  verified_at: string | null;
  source_rank: number; // authority of source doc; lower = more authoritative
  extractor_version: string; // e.g. 'fact-extractor@2026-07-01'
  created_at: string;
}

// ── task_steps: Acts + Checks under a task ───────────────────────────────────
export const STEP_KINDS = ["act", "check"] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export const CHECK_RESULTS = ["pass", "fail", "na"] as const;
export type CheckResult = (typeof CHECK_RESULTS)[number];

export const STEP_SOURCES = ["manual", "playbook", "assistant"] as const;
export type StepSource = (typeof STEP_SOURCES)[number];

interface TaskStepBase {
  id: string;
  lawyer_id: string;
  task_id: string; // steps die with the task
  title: string;
  description: string | null;
  position: number; // manual ordering within task+kind
  source: StepSource;
  playbook_item_id: string | null; // best-practice source ref
  source_note: string | null; // free-text authority when no playbook item
  created_at: string;
}

/** A `task_steps` row with kind='act' — a do-step; completed_at null = open. */
export interface Act extends TaskStepBase {
  kind: "act";
  completed_at: string | null;
  result: null;
  evaluated_at: null;
}

/** A `task_steps` row with kind='check' — a QA gate; result null = not yet evaluated. */
export interface Check extends TaskStepBase {
  kind: "check";
  completed_at: null;
  result: CheckResult | null;
  evaluated_at: string | null;
}

/** A raw `task_steps` row (either flavour) — narrow on `kind` to get Act | Check. */
export type TaskStep = Act | Check;

// ── citations: THE ledger ────────────────────────────────────────────────────
export const CITATION_REF_KINDS = ["record", "span"] as const;
export type CitationRefKind = (typeof CITATION_REF_KINDS)[number];

export const CITATION_RECORD_TABLES = ["fact", "activity", "task", "document", "matter"] as const;
export type CitationRecordTable = (typeof CITATION_RECORD_TABLES)[number];

export const CITATION_SUBJECTS = ["message", "fact", "activity", "task", "task_step"] as const;
export type CitationSubject = (typeof CITATION_SUBJECTS)[number];

/** Points at a whole DB row the lawyer can open. */
export type RecordRef = {
  kind: "record";
  table: CitationRecordTable;
  id: string; // uuid of the row
};

/** Points at a byte range inside a document's extracted text. */
export type SpanRef = {
  kind: "span";
  document_id: string;
  start_offset: number; // inclusive
  end_offset: number; // exclusive; > start_offset
};

export type CitationRef = RecordRef | SpanRef;

/** A raw `citations` row — the flattened record-ref | span-ref union, grouped by claim_id. */
export interface Citation {
  id: string;
  lawyer_id: string;
  matter_id: string;
  subject_type: CitationSubject; // which table holds the claim
  subject_id: string; // polymorphic; no FK (taggings pattern)
  claim_id: string; // the specific assertion
  position: number; // order of citations under one claim
  ref_kind: CitationRefKind;
  ref_table: CitationRecordTable | null; // record-ref only
  ref_id: string | null; // record-ref only; polymorphic, no FK
  document_id: string | null; // span-ref only
  start_offset: number | null; // span-ref only
  end_offset: number | null; // span-ref only
  quote: string | null; // cached excerpt for hover-render
  created_at: string;
}

/** `messages.metadata.claims` shape — joins a text range in a UIMessage part to citations.claim_id. */
export interface MessageClaimMap {
  claims?: Array<{
    claim_id: string; // joins citations.claim_id
    part: number; // index into parts[]
    start: number; // char range within that text part
    end: number;
  }>;
}

// ── playbook_items: layered State | Firm | Personal repo ────────────────────
export const PLAYBOOK_SCOPES = ["state", "firm", "personal"] as const;
export type PlaybookScope = (typeof PLAYBOOK_SCOPES)[number];

export const PLAYBOOK_KINDS = ["rule", "checklist", "template"] as const;
export type PlaybookKind = (typeof PLAYBOOK_KINDS)[number];

/** playbook_items.spec payload, shaped by `kind`. */
export type PlaybookSpec =
  | {
      kind: "rule"; // deterministic; feeds the rule engine
      when: Record<string, unknown>; // condition tree over task/matter/fact fields
      then: Record<string, unknown>; // effects: create deadline task, set priority, raise check...
    }
  | {
      kind: "checklist"; // default acts/checks fanned into task_steps on apply
      acts: Array<{ title: string; description?: string }>;
      checks: Array<{ title: string; description?: string; source_note?: string }>;
    }
  | {
      kind: "template"; // drafts
      format: "markdown";
      body: string;
      variables: string[]; // e.g. ['matter.title', 'client.display_name']
    };

/**
 * A raw `playbook_items` row. Override resolution for a slug (personal > firm
 * > state, most-specific applicability match wins within a layer) lives in
 * lib/playbook.ts — never by merging specs across layers.
 */
export interface PlaybookRule {
  id: string;
  scope: PlaybookScope;
  lawyer_id: string | null; // null iff scope='state' (global/system rows)
  firm_id: string | null; // forward slot; no firms table yet
  kind: PlaybookKind;
  slug: string; // stable identity across layers (the override chain key)
  title: string;
  description: string | null;
  forum_type: ForumType | null; // applicability filter; null = any forum
  task_type: TaskType | null; // applicability filter; null = any task type
  spec: PlaybookSpec;
  source_ref: string | null; // authority citation for state rows
  enabled: boolean; // disabled personal/firm rows still shadow lower layers
  created_at: string;
  updated_at: string;
}
