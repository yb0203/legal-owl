# Ideation — Working eCourts connection, demo'd in "See it in action"

Created: 2026-06-23
Mode: repo-grounded · Status: ranked, ready for ce-plan

## The feasibility verdict (grounded, firsthand)

A **genuinely working** eCourts connection is feasible **now** — confirmed live, not assumed:

- The `ECOURTS_API_KEY` (`eci_live…`) in `.env` is **valid**: an authenticated `GET https://webapi.ecourtsindia.com/api/partner/enums` returned **HTTP 200** with real data (10,161 court codes, 71 case statuses, 202 case types, 29 high courts, cause-list types). So auth works and the API is reachable from code.
- Provider is **ecourtsindia.com partner API** — a licensed third-party that absorbs the hard part (the official `services.ecourts.gov.in` is CAPTCHA-gated with **no public API**; NJDG's open API is **government-only**; scraping is a ToS/IT-Act risk). Using the licensed API to show a lawyer **their own** cases is the lowest-risk legal posture (DPDPA exempts public data).
- **CNR-only lookup, no CAPTCHA/session**: `GET /case/{cnr}` → parties, `caseStatus`, `nextHearingDate`, `filingDate`, `historyOfCaseHearings[]`, `judgmentOrders[]` (PDF `orderUrl`). Plus **bulk refresh up to 50 CNRs/call** (~30s), orders as signed-PDF/OCR/AI-markdown, Solr search, cause lists, and an AI order-summary (~₹2.50/call).
- **Coverage**: SC + all 25 HCs + 700+ district complexes (~29,600 courts) + tribunals (NCLT, ITAT, …).
- **Cost model**: billed **per successful request only** (failed/empty not charged); ₹200 free credits; pay-as-you-go ₹1,000; monthly/rate limits live in the dashboard; `429` → exponential backoff.

**Two gotchas to design around:** (1) Cloudflare fronts the API — programmatic calls must send a normal `User-Agent` + `Authorization: Bearer` (a bare HTTP-client UA gets 403); (2) the prototype's case-response field names are **mock-tested, never verified against a real response** — verify with one real CNR before trusting the parser.

**Production readiness:** schema is ready (`court_events` append-only + `source_type`, `triage_items`, `matters.cnr/lifecycle_state/last_successful_sync_at`, `hearings`, `deadlines`), but there is **zero sync infrastructure** — no route handlers, no cron, just a disabled "Connect — soon" card in Settings. The seed already has a `pending_first_sync` matter (Zenith) — a ready demo hook.

---

## Survivors (ranked)

### S1. A reusable CNR **sync engine** that diffs into the existing timeline *(foundational — everything else reuses it)*
One function: `case response → diff against stored state → append court_events (order_uploaded / hearing_date_changed / status_changed) + upsert hearings + update matter projections (next_hearing_date, court_status, lifecycle_state, last_successful_sync_at) + raise triage_items for material changes`. Idempotent via the existing `court_events.content_hash` natural key (no provider IDs needed). This is the spine; the three surfaces below are thin callers. **Why it wins:** it lands automation in the case-management foundation exactly as STRATEGY's "court monitoring" track intends, and reuses the append-only/provenance design already built.

### S2. **Connect-by-CNR** on add/edit — the magic first touch
Paste a CNR when creating/editing a matter → live single fetch (5–10s) auto-fills parties, forum, case type, status, next hearing, and **backfills** hearing history + orders into the timeline. Turns "manual Excel re-entry" into one paste. **Why it wins:** highest felt value, demoable in seconds, and it's how a real CNR enters the system (today `matters.cnr` is set by hand and never used).

### S3. **Nightly bulk cron** — "we watch the courts" *(the landing-page promise, made real)*
A Vercel Cron → route handler collects every matter with a CNR, calls **bulk refresh (50 CNRs/batch)**, runs S1's diff, and drops material changes into the **Inbox**. Daily cadence is sufficient (status/next-date change only on hearings; orders land 1–7 days after). **Why it wins:** it's the headline automation and maps 1:1 to the bulk endpoint.

### S4. **"Sync now"** per matter — instant feedback + demo driver
A button on the matter (and the Settings card) that runs S1 live. **Why it wins:** makes the connection tangible on demand, powers the demo, and gives lawyers control between nightly runs.

### S5. **Credit guardrails + the "last synced" trust artifact** *(necessary, not optional)*
Bill-on-success is in our favor; add: response caching/dedup, a per-account call cap, `429` backoff, surface remaining credits in Settings, and render `last_successful_sync_at` as a **staleness banner** (the transparency "trust artifact" already in the design notes). **Why it wins:** a paid, rate-limited API demands cost discipline, and "is this current?" is first-class for a trust product.

---

## The demo crux (the real design fork)

"See it in action" seeds **fake CNRs** (`TSHC0100…`) that will **not** resolve against the real API. To demo a *working* connection convincingly, the eCourts piece must use **real** data. Three ways (not mutually exclusive):

- **D1 — Connect *your own* real case (strongest "wow").** Onboarding/demo invites the lawyer to paste **one of their own real CNRs** → genuine live sync of their actual case into the timeline + inbox. Turns the demo into real value on first run. Cost: a couple of real API credits; needs the lawyer to have a CNR handy.
- **D2 — Seed 1–2 real *public* CNRs.** Replace one seeded matter's fake CNR with a real, public case so "Sync now" pulls genuine live data even if the lawyer has no CNR to hand. Always works in the demo; small recurring credit cost on each demo run.
- **D3 — Recorded-real fixture replay (cost-safe).** Capture one real API response once, store as a fixture, and the demo replays it as "synced" — deterministic, zero per-demo credits, offline-safe, but not *actually* live.

**Recommended:** **D2 + D1** — seed one real public CNR so the live magic always shows, and offer "Connect a real case" for the lawyer's own CNR (the genuine value). Keep the fake sample matters for breadth, clearly marked **Sample** (the banner we shipped); the eCourts demo piece is unmistakably real. Use **D3** as the cost-control fallback (e.g., a fixture when credits are exhausted).

---

## Rejected / deferred (with reasons)

- **Provider webhooks/push alerts instead of polling** — defer. Daily cron + on-demand covers the freshness need; provider-specific alert wiring is a v2 optimization, not needed to ship or demo.
- **Direct scraping of services.ecourts.gov.in** — rejected. CAPTCHA + ToS/IT-Act risk; the licensed API exists precisely to avoid this.
- **Switch providers (Surepass / Vakeel360)** — rejected for v1. ecourtsindia is already keyed, broadest coverage (25 HCs vs Vakeel360's 6), bulk endpoint, best docs. Keep as fallbacks only.
- **AI order-summaries in v1** — defer to the AI track. The `/order-summary` endpoint is paid per call and belongs with "Lawyer Assist," not the sync MVP.
- **MCP server integration** (`mcp.ecourtsindia.com`) — defer; relevant later for the AI assistant, not for sync.

---

## Open decisions for ce-plan / ce-brainstorm

1. **Demo strategy** (D1 / D2 / D3 / combination) — materially shapes the seed + onboarding work.
2. **Verify the real case-response schema** with one real CNR before trusting the prototype's assumed field names (one-credit spike).
3. **Connect flow scope** — paste-CNR auto-fill on the existing matter form vs a dedicated "Connect eCourts" wizard.
4. **Where the API client lives** — a TS port of the prototype's `ecourts_client.py` into `apps/web/lib/ecourts/` (Bearer + UA header, backoff, typed against `/enums`).
