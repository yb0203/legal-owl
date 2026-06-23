import type { ForumType } from "@/lib/types";
import type { Enums, EnumOption, NormalizedCase, RawCaseData } from "@/lib/ecourts/types";

// Resolve an enum code to its human description; fall back to the code itself.
function describe(list: EnumOption[] | undefined, code: string | undefined): string | null {
  if (!code) return null;
  const hit = list?.find((o) => o.code === code);
  return hit?.description ?? code;
}

// Map the API's courtType (string) to the app's ForumType. Heuristic by keyword
// (the API has ~20 court types); pending tightening against real data (plan U1).
function toForum(courtType: string | null): ForumType | null {
  if (!courtType) return null;
  const s = courtType.toLowerCase();
  if (s.includes("supreme")) return "supreme_court";
  if (s.includes("high court")) return "high_court";
  if (s.includes("nclat")) return "nclat";
  if (s.includes("nclt") || s.includes("national company law")) return "nclt";
  if (s.includes("arbitr")) return "arbitration";
  if (s.includes("district") || s.includes("sessions") || s.includes("civil")) return "district";
  if (s.includes("tribunal") || s.includes("itat") || s.includes("cestat") || s.includes("cat"))
    return "tribunal";
  return "other";
}

// A case is disposed when its status reads as concluded.
function isDisposed(status: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes("dispos") || s.includes("decided") || s.includes("closed");
}

export function normalizeCase(raw: RawCaseData, enums: Enums | null): NormalizedCase {
  const status = describe(enums?.caseStatus, raw.caseStatus);
  const courtTypeDesc = describe(enums?.courtType, raw.courtType);
  const forum = toForum(courtTypeDesc);
  const disposed = isDisposed(status);

  const hearings = (raw.historyOfCaseHearings ?? [])
    .map((h) => ({
      hearing_date: (h.hearingDate ?? h.businessOnDate ?? "").slice(0, 10),
      purpose: h.purposeOfListing ?? null,
      outcome: h.businessOnDate ?? null,
    }))
    .filter((h) => h.hearing_date);

  const orders = (raw.judgmentOrders ?? [])
    .map((o) => ({ order_date: (o.orderDate ?? "").slice(0, 10), url: o.orderUrl ?? null }))
    .filter((o) => o.order_date);

  return {
    petitioners: raw.petitioners ?? [],
    respondents: raw.respondents ?? [],
    forum_type: forum,
    case_type: describe(enums?.caseType, raw.caseType) ?? raw.caseTypeRaw ?? null,
    court_status: status,
    next_hearing_date: raw.nextHearingDate ? raw.nextHearingDate.slice(0, 10) : null,
    hearings,
    orders,
    lifecycle_hint: disposed ? "disposed" : "active",
    matter_status_hint: disposed ? "disposed" : "active",
  };
}
