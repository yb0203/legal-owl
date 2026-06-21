// Domain types for Case Workflow — mirrors supabase/migrations/20260621000001_case_workflow.sql

export type ForumType =
  | "district"
  | "high_court"
  | "supreme_court"
  | "nclt"
  | "nclat"
  | "arbitration"
  | "tribunal"
  | "other";

export type MatterStatus = "active" | "on_hold" | "disposed";
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
