// Shapes for the ecourtsindia.com partner API (https://webapi.ecourtsindia.com/api/partner)
// and the normalized domain shapes the sync engine consumes. The raw field names
// mirror the prototype's reverse-engineered parser (prototype/ecourts-streamlit/
// lib/ecourts_client.py) and are pending live verification (plan U1) — the client
// reads defensively with fallbacks until a real /case/{cnr} response confirms them.

/** A 16-char Case Number Record, e.g. "DLHC010004222025". */
export type Cnr = string;

export interface RawHearing {
  hearingDate?: string;
  businessOnDate?: string;
  purposeOfListing?: string;
}

export interface RawOrder {
  orderDate?: string;
  orderUrl?: string;
}

/** The `data.courtCaseData` object from GET /case/{cnr} (defensive — fields optional). */
export interface RawCaseData {
  petitioners?: string[];
  respondents?: string[];
  judges?: string[];
  caseStatus?: string;
  nextHearingDate?: string;
  filingDate?: string;
  cnrCourtCode?: string;
  courtComplexCode?: string;
  courtType?: string;
  caseType?: string;
  caseTypeRaw?: string;
  cnrCaseNumber?: string;
  registrationNumber?: string;
  courtName?: string;
  state?: string;
  stateCode?: string;
  historyOfCaseHearings?: RawHearing[];
  judgmentOrders?: RawOrder[];
}

/** Result of a client call — never throws on "not found"; callers branch on `ok`. */
export type CaseResult =
  | { ok: true; data: RawCaseData }
  | { ok: false; reason: "not_found" | "rate_limited" | "unauthorized" | "error"; status?: number };

export interface EnumOption {
  code: string;
  description: string;
}
export interface Enums {
  caseStatus: EnumOption[];
  caseType: EnumOption[];
  courtType: EnumOption[];
  courtCode: EnumOption[];
  stateCode: EnumOption[];
  [key: string]: EnumOption[];
}

// ── Normalized domain shapes (what the engine reads) ──────────────────────────
import type { ForumType, MatterStatus, LifecycleState } from "@/lib/types";

export interface NormalizedHearing {
  hearing_date: string;
  purpose: string | null;
  outcome: string | null;
}
export interface NormalizedOrder {
  order_date: string;
  url: string | null;
}
export interface NormalizedCase {
  petitioners: string[];
  respondents: string[];
  forum_type: ForumType | null;
  case_type: string | null;
  court_status: string | null;
  next_hearing_date: string | null;
  hearings: NormalizedHearing[];
  orders: NormalizedOrder[];
  lifecycle_hint: LifecycleState;
  matter_status_hint: MatterStatus | null;
}
