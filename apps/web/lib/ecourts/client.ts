// Server-only: only import this from route handlers, server actions, or cron.
// It reads ECOURTS_API_KEY (never NEXT_PUBLIC) so it must not reach the client bundle.
import type { CaseResult, Cnr, Enums, RawCaseData, SearchCasesResult, SearchResult, SearchType } from "@/lib/ecourts/types";

// Server-only client for the ecourtsindia.com partner API. Bearer auth + a real
// User-Agent (Cloudflare 403s bare clients — verified). CNR lookup is a single
// GET; billed per success only, so callers should avoid redundant calls. Never
// throws on "not found" / rate-limit — returns a typed result so the UI degrades.

const BASE = "https://webapi.ecourtsindia.com/api/partner";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36 LegalOwl/1.0";

function getApiKey(): string | null {
  return process.env.ECOURTS_API_KEY || null;
}

function authHeaders(): HeadersInit {
  const key = getApiKey();
  if (!key) throw new Error("ECOURTS_API_KEY is not set");
  return { Authorization: `Bearer ${key}`, "User-Agent": UA, Accept: "application/json" };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// GET with exponential backoff on 429 (1s → 2s → 4s) and a timeout.
async function getJson(
  path: string,
  { timeoutMs = 30_000, retries = 3 }: { timeoutMs?: number; retries?: number } = {},
): Promise<{ status: number; body: unknown }> {
  let attempt = 0;
  for (;;) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${BASE}${path}`, { headers: authHeaders(), signal: ctrl.signal });
      if (res.status === 429 && attempt < retries) {
        attempt += 1;
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
      const body = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
      return { status: res.status, body };
    } catch (e) {
      if (attempt < retries && e instanceof Error && e.name === "AbortError") {
        attempt += 1;
        await sleep(500 * attempt);
        continue;
      }
      throw e;
    } finally {
      clearTimeout(t);
    }
  }
}

/** Look up a single case by CNR. */
export async function getCase(cnr: Cnr): Promise<CaseResult> {
  if (!getApiKey()) return { ok: false, reason: "unauthorized" };
  try {
    const { status, body } = await getJson(`/case/${encodeURIComponent(cnr)}`);
    if (status === 401 || status === 403) return { ok: false, reason: "unauthorized", status };
    if (status === 429) return { ok: false, reason: "rate_limited", status };
    if (status === 404) return { ok: false, reason: "not_found", status };
    const data = (body as { data?: { courtCaseData?: RawCaseData } })?.data?.courtCaseData;
    if (status >= 200 && status < 300 && data) return { ok: true, data };
    return { ok: false, reason: status >= 200 && status < 300 ? "not_found" : "error", status };
  } catch (err) {
    console.error("[ecourts] getCase error:", err);
    return { ok: false, reason: "error" };
  }
}

/** Bulk refresh up to 50 CNRs in one call (provider-supported). */
export async function bulkRefresh(cnrs: Cnr[]): Promise<Record<string, CaseResult>> {
  // Provider caps at 50 per call; the cron batches before calling this.
  const out: Record<string, CaseResult> = {};
  // The bulk endpoint shape is pending live verification (plan U1); until then,
  // fan out single lookups so the engine path is exercised. Swap to the real
  // bulk POST once its request/response is confirmed.
  for (const cnr of cnrs.slice(0, 50)) {
    out[cnr] = await getCase(cnr);
  }
  return out;
}

let enumsCache: Enums | null = null;
/** Reference enums (court/status/type codes), fetched once and cached per runtime. */
// Daily cause list (the court's board for a date). Free per the partner docs; the
// exact query/response shape is pending live verification (see the eCourts audit).
// Wired forward for the "morning board" Court Scout agent — not consumed in the UI yet.
export async function getCauseList(params: {
  date: string; // yyyy-mm-dd
  courtCode?: string;
}): Promise<{ ok: boolean; body: unknown }> {
  const q = new URLSearchParams({ date: params.date });
  if (params.courtCode) q.set("court", params.courtCode);
  const { status, body } = await getJson(`/causelist/search?${q.toString()}`);
  return { ok: status === 200, body };
}

/** Search cases by party name, FIR number, or filing number.
 *  Returns a typed result — never throws on rate-limit or error. */
export async function searchCases(params: {
  query: string;
  searchType: SearchType;
  stateCode?: string;
}): Promise<SearchCasesResult> {
  try {
    if (!process.env.ECOURTS_API_KEY) return { ok: false, reason: "unauthorized" };
    const q = new URLSearchParams({
      q: params.query,
      type: params.searchType,
    });
    if (params.stateCode) q.set("state", params.stateCode);
    const { status, body } = await getJson(`/search?${q.toString()}`);
    if (status === 401 || status === 403) return { ok: false, reason: "unauthorized", status };
    if (status === 429) return { ok: false, reason: "rate_limited", status };
    if (status < 200 || status >= 300) return { ok: false, reason: "error", status };
    // Defensive parse — field names pending live verification.
    const items = (body as { data?: { cases?: unknown[] } })?.data?.cases ?? [];
    const results: SearchResult[] = items.map((raw) => {
      const r = raw as {
        cnr?: string;
        title?: string;
        court?: string;
        status?: string;
        nextHearingDate?: string;
      };
      return {
        cnr: r.cnr ?? "",
        title: r.title ?? r.cnr ?? "",
        court: r.court ?? "",
        status: r.status ?? null,
        nextHearingDate: r.nextHearingDate ? r.nextHearingDate.slice(0, 10) : null,
      };
    }).filter((r) => r.cnr);
    return { ok: true, results };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export async function getEnums(): Promise<Enums | null> {
  if (enumsCache) return enumsCache;
  try {
    const { status, body } = await getJson(`/enums`);
    if (status < 200 || status >= 300) return null;
    const e = (body as { data?: { enums?: Enums } })?.data?.enums ?? null;
    if (e) enumsCache = e;
    return e;
  } catch {
    return null;
  }
}
