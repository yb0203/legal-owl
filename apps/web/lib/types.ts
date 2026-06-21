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

export type LifecycleState =
  | "pending_first_sync"
  | "active"
  | "not_found"
  | "disposed";

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
