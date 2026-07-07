// Shapes for the ecourtsindia.com partner API (https://webapi.ecourtsindia.com/api/partner)
// and the normalized domain shapes the sync engine consumes. The raw field names
// are pending live verification against a real /case/{cnr} response — the client
// reads defensively with fallbacks until confirmed.

/** A 16-char Case Number Record, e.g. "DLHC010004222025". */
export type Cnr = string;

export interface RawHearing {
  hearingDate?: string;
  businessOnDate?: string;  // what actually transpired (vs purposeOfListing = what was scheduled)
  purposeOfListing?: string;
}

export interface RawOrder {
  orderDate?: string;
  orderUrl?: string;
  ocrMarkdown?: string;     // OCR-processed text from eCourts (free, no extra cost)
  orderType?: string;       // 'judgment' | 'interim' | 'order'
}

export interface RawActSection {
  act: string;
  sections: string[];
}

export interface RawInterimApplication {
  iaNumber?: string;
  status?: string;
  nextDate?: string;
}

export interface RawAdvocate {
  name: string;
  side?: string;  // 'petitioner' | 'respondent' | 'other'
}

/** The `data.courtCaseData` object from GET /case/{cnr} (defensive — fields optional). */
export interface RawCaseData {
  petitioners?: string[];
  respondents?: string[];
  judges?: string[];
  advocates?: RawAdvocate[];
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
  actsAndSections?: RawActSection[];
  interimApplications?: RawInterimApplication[];
  connectedCases?: string[];        // CNRs of related/tagged matters
  historyOfCaseHearings?: RawHearing[];
  judgmentOrders?: RawOrder[];
  interimOrders?: RawOrder[];
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

/** Search result from GET /search. */
export interface SearchResult {
  cnr: string;
  title: string;       // e.g. "Petitioner vs Respondent"
  court: string;
  status: string | null;
  nextHearingDate: string | null;
}

export type SearchType = "party_name" | "fir_number" | "filing_number";

export type SearchCasesResult =
  | { ok: true; results: SearchResult[] }
  | { ok: false; reason: "rate_limited" | "unauthorized" | "error"; status?: number };

// ── Normalized domain shapes (what the engine reads) ──────────────────────────
import type { ForumType, MatterStatus, LifecycleState } from "@/lib/types";

export interface NormalizedHearing {
  hearing_date: string;
  purpose: string | null;
  outcome: string | null;
  business_on_date: string | null;  // what actually happened (from businessOnDate)
}

export interface NormalizedOrder {
  order_date: string;
  url: string | null;
  ocr_markdown: string | null;  // eCourts OCR text (used for PDF-free ingestion)
  order_type: string | null;
}

export interface NormalizedAdvocate {
  name: string;
  side: "petitioner" | "respondent" | "other";
}

export interface NormalizedActSection {
  act: string;
  sections: string[];
}

export interface NormalizedInterimApplication {
  ia_number: string | null;
  status: string | null;
  next_date: string | null;
}

export interface NormalizedCase {
  petitioners: string[];
  respondents: string[];
  judges: string[];
  advocates: NormalizedAdvocate[];
  forum_type: ForumType | null;
  case_type: string | null;
  court_status: string | null;
  next_hearing_date: string | null;
  filing_date: string | null;
  registration_number: string | null;
  state: string | null;
  state_code: string | null;
  acts_sections: NormalizedActSection[];
  interim_applications: NormalizedInterimApplication[];
  connected_cnrs: string[];
  hearings: NormalizedHearing[];
  orders: NormalizedOrder[];
  lifecycle_hint: LifecycleState;
  matter_status_hint: MatterStatus | null;
}
