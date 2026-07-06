import type { ForumType } from "@/lib/types";
import type { Enums, EnumOption, NormalizedCase, RawCaseData } from "@/lib/ecourts/types";

// Resolve an enum code to its human description; fall back to the code itself.
function describe(list: EnumOption[] | undefined, code: string | undefined): string | null {
  if (!code) return null;
  const hit = list?.find((o) => o.code === code);
  return hit?.description ?? code;
}

// Map the court to the app's ForumType. Verified against real data (plan U1):
// `courtType` is often null, so derive from courtName/cnrCourtCode (e.g. "MPHC"
// → high_court). Forum is only used to prefill a new matter; the sync engine
// never overwrites the lawyer's chosen forum.
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

// A case is disposed when its status reads as concluded.
function isDisposed(status: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes("dispos") || s.includes("decided") || s.includes("closed");
}

export function normalizeCase(raw: RawCaseData, enums: Enums | null): NormalizedCase {
  const status = describe(enums?.caseStatus, raw.caseStatus);
  // courtType is frequently null (verified U1) — fall back to court name/code.
  const forum = toForum(raw.courtName ?? raw.cnrCourtCode ?? describe(enums?.courtType, raw.courtType));
  const disposed = isDisposed(status);

  const hearings = (raw.historyOfCaseHearings ?? [])
    .map((h) => ({
      hearing_date: (h.hearingDate ?? "").slice(0, 10),
      purpose: h.purposeOfListing ?? null,
      outcome: null as string | null, // the API hearing history carries no outcome field
    }))
    .filter((h) => h.hearing_date);

  // Both interim and judgment orders count as "orders" on the timeline.
  const orders = [...(raw.judgmentOrders ?? []), ...(raw.interimOrders ?? [])]
    .map((o) => ({ order_date: (o.orderDate ?? "").slice(0, 10), url: o.orderUrl ?? null }))
    .filter((o) => o.order_date);

  return {
    petitioners: raw.petitioners ?? [],
    respondents: raw.respondents ?? [],
    forum_type: forum,
    case_type: describe(enums?.caseType, raw.caseType) ?? raw.caseTypeRaw ?? null,
    court_status: status,
    next_hearing_date: raw.nextHearingDate ? raw.nextHearingDate.slice(0, 10) : null,
    // Kept for the cause-list lookup (getCauseList's `courtCode` param) — not
    // otherwise surfaced; already present on the response we fetched, so
    // carrying it forward costs no extra API call.
    court_code: raw.cnrCourtCode ?? raw.courtComplexCode ?? null,
    hearings,
    orders,
    lifecycle_hint: disposed ? "disposed" : "active",
    matter_status_hint: disposed ? "disposed" : "active",
  };
}
