import type { ForumType } from "@/lib/types";
import type {
  Enums,
  EnumOption,
  NormalizedCase,
  NormalizedAdvocate,
  RawCaseData,
} from "@/lib/ecourts/types";

// Resolve an enum code to its human description; fall back to the code itself.
function describe(list: EnumOption[] | undefined, code: string | undefined): string | null {
  if (!code) return null;
  const hit = list?.find((o) => o.code === code);
  return hit?.description ?? code;
}

// Map the court to the app's ForumType. `courtType` is often null in real data,
// so derive from courtName/cnrCourtCode (e.g. "MPHC" → high_court).
// Forum is only used to prefill a new matter; the sync engine never overwrites
// the lawyer's chosen forum.
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

function normalizeSide(side: string | undefined): NormalizedAdvocate["side"] {
  if (!side) return "other";
  const s = side.toLowerCase();
  if (s.includes("petitioner") || s.includes("plaintiff") || s.includes("appellant"))
    return "petitioner";
  if (s.includes("respondent") || s.includes("defendant")) return "respondent";
  return "other";
}

export function normalizeCase(raw: RawCaseData, enums: Enums | null): NormalizedCase {
  const status = describe(enums?.caseStatus, raw.caseStatus);
  const forum = toForum(
    raw.courtName ?? raw.cnrCourtCode ?? describe(enums?.courtType, raw.courtType),
  );
  const disposed = isDisposed(status);

  const hearings = (raw.historyOfCaseHearings ?? [])
    .map((h) => ({
      hearing_date: (h.hearingDate ?? "").slice(0, 10),
      purpose: h.purposeOfListing ?? null,
      outcome: null as string | null,
      business_on_date: h.businessOnDate ? h.businessOnDate.slice(0, 10) : null,
    }))
    .filter((h) => h.hearing_date);

  // Both interim and judgment orders count as "orders" on the timeline.
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

  return {
    petitioners: raw.petitioners ?? [],
    respondents: raw.respondents ?? [],
    judges: raw.judges ?? [],
    advocates: (raw.advocates ?? []).map((a) => ({
      name: a.name,
      side: normalizeSide(a.side),
    })),
    forum_type: forum,
    case_type: describe(enums?.caseType, raw.caseType) ?? raw.caseTypeRaw ?? null,
    court_status: status,
    next_hearing_date: raw.nextHearingDate ? raw.nextHearingDate.slice(0, 10) : null,
    filing_date: raw.filingDate ? raw.filingDate.slice(0, 10) : null,
    registration_number: raw.registrationNumber ?? null,
    state: raw.state ?? null,
    state_code: raw.stateCode ?? null,
    acts_sections: (raw.actsAndSections ?? []).map((a) => ({
      act: a.act,
      sections: a.sections ?? [],
    })),
    interim_applications: (raw.interimApplications ?? []).map((ia) => ({
      ia_number: ia.iaNumber ?? null,
      status: ia.status ?? null,
      next_date: ia.nextDate ? ia.nextDate.slice(0, 10) : null,
    })),
    connected_cnrs: raw.connectedCases ?? [],
    hearings,
    orders,
    lifecycle_hint: disposed ? "disposed" : "active",
    matter_status_hint: disposed ? "disposed" : "active",
  };
}
