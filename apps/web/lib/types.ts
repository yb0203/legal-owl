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
export type TriageStateType = "pending" | "accepted" | "dismissed";

export interface Action {
  id: string;
  key: string;
  title: string;
  description: string | null;
  priority: ActionPriority;
  due_date: string | null;
  completed_at: string | null;
  matter_id: string;
  state?: Pick<WorkflowState, "name" | "type"> | null;
  matter?: Pick<Matter, "id" | "title"> | null;
}

export interface Hearing {
  id: string;
  hearing_date: string;
  purpose: string | null;
  outcome: string | null;
  state: HearingStateType;
}

export interface Deadline {
  id: string;
  type: "limitation" | "statutory" | "internal";
  due_date: string;
  basis: string | null;
}

export interface CourtEvent {
  id: string;
  event_type: string;
  previous_value: string | null;
  new_value: string | null;
  occurred_at: string | null;
  detected_at: string;
  source_type: EventSource;
}

export interface Remark {
  id: string;
  body: string;
  created_at: string;
}

export interface TriageItem {
  id: string;
  kind: string;
  summary: string;
  state: TriageStateType;
  created_at: string;
  matter?: Pick<Matter, "id" | "title" | "key"> | null;
}

// ── Client → Engagement layer ───────────────────────────────────────────────
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

export type EngagementStatus = "open" | "on_hold" | "closed";

export interface Engagement {
  id: string;
  client_id: string;
  name: string;
  scope_note: string | null;
  status: EngagementStatus;
  created_at: string;
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
