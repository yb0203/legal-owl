import type { ForumType } from "@/lib/types";
import type { Enums, EnumOption, NormalizedCase, RawCaseData } from "@/lib/ecourts/types";

// Resolve an enum code to its human description, using the inline enumLookup
// the API returns, then falling back to the global enums table.
function describe(
  raw: RawCaseData,
  field: string,
  code: string | undefined,
  globalList?: EnumOption[],
): string | null {
  if (!code) return null;
  // The API returns per-field inline lookups in descriptions.enumLookup.
  const inline = raw.descriptions?.enumLookup?.[field]?.[code];
  if (inline) return inline;
  const hit = globalList?.find((o) => o.code === code);
  return hit?.description ?? code;
}

// Map court name / court code to the app's ForumType.
// Uses courtName (e.g. "MPHC") or cnrCourtCode (e.g. "MPHC03").
function toForum(name: string | null): ForumType | null {
  if (!name) return null;
  const s = name.toUpperCase();
  if (/SUPREME|\bSCIN\b/.test(s)) return "supreme_court";
  if (/NCLAT/.test(s)) return "nclat";
  if (/NCLT/.test(s)) return "nclt";
  if (/CESTAT|ITAT|\bCAT\b|\bDRT\b|\bAFT\b|\bNGT\b|TRIBUNAL/.test(s)) return "tribunal";
  if (/ARBITR/.test(s)) return "arbitration";
  if (/HC|HIGH COURT/.test(s)) return "high_court";
  return "district";
}

function isDisposed(status: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes("dispos") || s.includes("decided") || s.includes("closed");
}

export function normalizeCase(raw: RawCaseData, enums: Enums | null): NormalizedCase {
  const courtDisplay = raw.courtName ?? raw.cnrCourtCode ?? null;
  const status = describe(raw, "caseStatus", raw.caseStatus, enums?.caseStatus);
  const forum = toForum(courtDisplay);
  const disposed = isDisposed(status ?? raw.disposalType ?? null);

  const hearings = (raw.historyOfCaseHearings ?? [])
    .map((h) => ({
      hearing_date: (h.hearingDate ?? "").slice(0, 10),
      purpose: h.purposeOfListing ?? null,
      outcome: null as string | null,
      business_on_date: h.businessOnDate ? h.businessOnDate.slice(0, 10) : null,
      judge: h.judge ?? null,
    }))
    .filter((h) => h.hearing_date);

  const orders = [
    ...(raw.judgmentOrders ?? []).map((o) => ({ ...o, order_type: "judgment" as const })),
    ...(raw.interimOrders ?? []).map((o) => ({ ...o, order_type: "interim" as const })),
  ]
    .map((o) => ({
      order_date: (o.orderDate ?? "").slice(0, 10),
      url: o.orderUrl ?? null,
      ocr_markdown: o.ocrMarkdown ?? null,
      order_type: o.order_type,
    }))
    .filter((o) => o.order_date);

  const interlocutory_applications = (raw.interlocutoryApplications ?? []).map((ia) => ({
    ia_number: ia.iaNumber ?? null,
    status: ia.status ?? null,
    next_date: ia.nextDate ? ia.nextDate.slice(0, 10) : null,
  }));

  // Derive case type display: prefer raw display string, fall back to enum lookup.
  const case_type =
    raw.caseTypeRaw ??
    describe(raw, "caseType", raw.caseType, enums?.caseType) ??
    null as string | null;

  return {
    petitioners: raw.petitioners ?? [],
    respondents: raw.respondents ?? [],
    petitioner_advocates: raw.petitionerAdvocates ?? [],
    respondent_advocates: raw.respondentAdvocates ?? [],
    judges: raw.judges ?? [],
    forum_type: forum,
    court_code: raw.cnrCourtCode ?? null,
    court_name: courtDisplay,
    case_type,
    case_type_raw: raw.caseTypeRaw ?? null,
    court_status: status,
    next_hearing_date: raw.nextHearingDate ? raw.nextHearingDate.slice(0, 10) : null,
    first_hearing_date: raw.firstHearingDate ? raw.firstHearingDate.slice(0, 10) : null,
    filing_date: raw.filingDate ? raw.filingDate.slice(0, 10) : null,
    registration_number: raw.registrationNumber ?? raw.filingNumber ?? null,
    disposal_type: raw.disposalTypeRaw ?? raw.disposalType ?? null,
    state: raw.state ?? null,
    state_code: raw.stateCode ?? null,
    hearing_count: raw.hearingCount ?? 0,
    interlocutory_applications,
    tagged_matters: raw.taggedMatters ?? [],
    hearings,
    orders,
    lifecycle_hint: disposed ? "disposed" : "active",
    matter_status_hint: disposed ? "disposed" : "active",
  };
}
