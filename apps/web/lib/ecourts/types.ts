// Shapes for the ecourtsindia.com partner API (https://webapi.ecourtsindia.com/api/partner)
// Field names are verified against the live API response (sample: MPHC030028202013).

/** A 16-char Case Number Record, e.g. "MPHC030028202013". */
export type Cnr = string;

/** Extract the 6-char court code from a CNR: "MPHC030028202013" → "MPHC03". */
export function courtCodeFromCnr(cnr: string): string {
  return cnr.slice(0, 6).toUpperCase();
}

export interface RawHearing {
  judge?: string;           // individual judge for this hearing
  hearingDate?: string;
  businessOnDate?: string;  // what actually transpired at the hearing
  purposeOfListing?: string;
}

export interface RawOrder {
  orderDate?: string;
  orderUrl?: string;
  ocrMarkdown?: string;     // OCR-processed text provided by eCourts
  orderType?: string;
}

export interface RawInterlocutoryApplication {
  iaNumber?: string;
  status?: string;
  nextDate?: string;
}

/** The `data.courtCaseData` object from GET /case/{cnr}. Field names verified from fixture. */
export interface RawCaseData {
  // Parties
  petitioners?: string[];
  respondents?: string[];
  petitionerAdvocates?: string[];   // flat string list, not typed objects
  respondentAdvocates?: string[];

  // Case identity
  cnr?: string;
  cnrCourtCode?: string;            // e.g. "MPHC03" — use for cause list lookups
  courtComplexCode?: string;
  courtName?: string;               // e.g. "MPHC"
  courtNo?: number;
  caseType?: string;                // enum code, e.g. "CR_MISC"
  caseTypeRaw?: string;             // display value, e.g. "MCRC"
  cnrCaseNumber?: string;
  caseStatus?: string;              // enum code, e.g. "DISPOSED"
  filingNumber?: string;
  registrationNumber?: string;
  judicialSection?: string;

  // Dates
  filingDate?: string;
  registrationDate?: string;
  firstHearingDate?: string;
  lastHearingDate?: string;
  nextHearingDate?: string;
  decisionDate?: string;

  // Geography
  state?: string;
  stateCode?: string;
  districtCode?: string;

  // Outcome
  disposalType?: string;
  disposalTypeRaw?: string;
  contestedStatus?: string;

  // Counts (useful for display)
  hearingCount?: number;
  orderCount?: number;
  judgmentCount?: number;
  iaCount?: number;
  caseDurationDays?: number;

  // Judges (usually empty at case level — per-hearing judge is in historyOfCaseHearings[].judge)
  judges?: string[];

  // History
  historyOfCaseHearings?: RawHearing[];
  judgmentOrders?: RawOrder[];
  interimOrders?: RawOrder[];
  interlocutoryApplications?: RawInterlocutoryApplication[];
  taggedMatters?: string[];         // CNRs of related/tagged matters
  listingDates?: string[];

  // Enum lookups (returned inline by the API)
  descriptions?: {
    enumLookup?: Record<string, Record<string, string>>;
  };
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
  title: string;
  court: string;
  status: string | null;
  nextHearingDate: string | null;
}

export type SearchType = "party_name" | "fir_number" | "filing_number";

export type SearchCasesResult =
  | { ok: true; results: SearchResult[] }
  | { ok: false; reason: "rate_limited" | "unauthorized" | "error"; status?: number };

// ── Normalized domain shapes (what the sync engine and UI consume) ─────────────
import type { ForumType, MatterStatus, LifecycleState } from "@/lib/types";

export interface NormalizedHearing {
  hearing_date: string;
  purpose: string | null;
  outcome: string | null;
  business_on_date: string | null;
  judge: string | null;
}

export interface NormalizedOrder {
  order_date: string;
  url: string | null;
  ocr_markdown: string | null;
  order_type: string | null;
}

export interface NormalizedInterlocutoryApplication {
  ia_number: string | null;
  status: string | null;
  next_date: string | null;
}

export interface NormalizedCase {
  petitioners: string[];
  respondents: string[];
  petitioner_advocates: string[];
  respondent_advocates: string[];
  judges: string[];                         // usually empty at case level
  forum_type: ForumType | null;
  court_code: string | null;                // cnrCourtCode e.g. "MPHC03"
  court_name: string | null;
  case_type: string | null;
  case_type_raw: string | null;
  court_status: string | null;
  next_hearing_date: string | null;
  first_hearing_date: string | null;
  filing_date: string | null;
  registration_number: string | null;
  disposal_type: string | null;
  state: string | null;
  state_code: string | null;
  hearing_count: number;
  interlocutory_applications: NormalizedInterlocutoryApplication[];
  tagged_matters: string[];                 // related case CNRs
  hearings: NormalizedHearing[];
  orders: NormalizedOrder[];
  lifecycle_hint: LifecycleState;
  matter_status_hint: MatterStatus | null;
}
