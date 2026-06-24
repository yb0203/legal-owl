// Server-only: only import this from route handlers, server actions, or cron.
// It reads ECOURTS_API_KEY (never NEXT_PUBLIC) so it must not reach the client bundle.
import type { CaseResult, Cnr, Enums, RawCaseData } from "@/lib/ecourts/types";

// Server-only client for the ecourtsindia.com partner API. Bearer auth + a real
// User-Agent (Cloudflare 403s bare clients — verified). CNR lookup is a single
// GET; billed per success only, so callers should avoid redundant calls. Never
// throws on "not found" / rate-limit — returns a typed result so the UI degrades.

const BASE = "https://webapi.ecourtsindia.com/api/partner";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36 LegalOwl/1.0";

function authHeaders(): HeadersInit {
  const key = process.env.ECOURTS_API_KEY;
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
  try {
    const { status, body } = await getJson(`/case/${encodeURIComponent(cnr)}`);
    if (status === 401 || status === 403) return { ok: false, reason: "unauthorized", status };
    if (status === 429) return { ok: false, reason: "rate_limited", status };
    if (status === 404) return { ok: false, reason: "not_found", status };
    const data = (body as { data?: { courtCaseData?: RawCaseData } })?.data?.courtCaseData;
    if (status >= 200 && status < 300 && data) return { ok: true, data };
    return { ok: false, reason: status >= 200 && status < 300 ? "not_found" : "error", status };
  } catch {
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
