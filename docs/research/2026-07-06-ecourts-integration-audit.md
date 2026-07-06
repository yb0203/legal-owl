---
name: eCourts integration audit — depth, gaps, and the agent-leverage plan
last_updated: 2026-07-06
---

# eCourts integration audit + agent-leverage plan

How deeply eCourts India is integrated today, what the partner API can actually do, and how to
use it so agents drive ~100% of a solo litigator's desk work. Grounded in a codebase audit and
API-capability research (partner-API field names are reconstructed from indexed docs — verify
against a live authenticated call before coding).

## Bottom line

The integration is a **solid but shallow, read-only foundation**, and — the key finding — **the
agent leverage is designed but never turned on**. Concretely:

- We use **1 of the API's ~6 capability families** (CNR lookup) and normalize **~10 of ~40+
  returned fields**. Cause lists, search, order/judgment documents, interim applications,
  connected cases, and advocates are all available and all unused.
- Court syncs today produce **deterministic, dumb Inbox rows** — never an agent summary, draft, or
  proposal. The `"ecourts.synced"` ambient event exists (`lib/agents/orchestrator.ts:62`), agents
  exist, but **`runAmbient()` is never called anywhere** (`sync.ts`/`run.ts`/the cron never fire
  it). The sensor is wired to nothing.
- It is **read-only, nightly, poll-only, single-shared-key** — no order ingestion, no morning
  board, no search-driven intake, no per-lawyer credits.

So: eCourts is a good sensor bolted to a dumb pipe. The path to agent-driven workflow is (1) flip
the agent wiring on, (2) exploit the free + document capabilities we're ignoring, (3) close the
read → ground → act loop.

## Part 1 — What's wired today

**Pipeline** (`lib/ecourts/`): `getCase(cnr)` → `normalize` → `syncOneMatter` diff → writes.
- `client.ts` makes exactly **3 GET calls**: `GET /case/{cnr}`, `GET /enums`, and a `bulkRefresh`
  that *fakes* bulk by looping single lookups — and is **never called**.
- `normalize.ts` keeps only: parties, forum (regex-guessed from court name), case_type,
  court_status, next_hearing_date, hearings (date+purpose, outcome always null), orders (date+URL),
  lifecycle hint.
- `sync.ts` derives 3 event kinds — `status_changed`, `hearing_date_changed`, `order_uploaded` —
  idempotent on `content_hash`, raises new ones as Triage/Inbox tasks, upserts hearing tasks, and
  overwrites `court_status` / `next_hearing_date` / `lifecycle_state` on the matter.

**Triggers**: nightly Vercel cron (`0 1 * * *`, `.limit(500)`), "Sync now" (per matter), "Sync all"
(`.limit(100)`), connect-by-CNR on matter create (best-effort). Three uncoordinated caps, no shared
spend budget; a single shared `ECOURTS_API_KEY`.

**Surfaces**: matter detail (status, next hearing, timeline, hearings tab), Inbox (synced triage
items), Home (updates banner + next hearings), Calendar (hearings), Matters list, Settings
(boolean configured). Manual-only: `matter_status`, deadlines, documents.

## Part 2 — The depth gap (available vs used)

| Capability | Available in partner API | Used today |
|---|---|---|
| CNR case lookup | rich: parties, **advocates**, judge, status/stage, filing/decision dates, next hearing, hearing history, **acts & sections**, **FIR details**, **interim applications (IAs)**, **connected/tagged cases**, **earlier-court lineage**, disposal type | ~10 fields; the rest **dropped** in `normalize.ts` (and never even typed in `RawCaseData`) |
| **Cause lists** (daily board) — **FREE, no credits** | party/judge/time-slot board, filterable by date/court/advocate/litigant | **not called** — no morning-board feature |
| **Search** (Solr) — party / advocate / **FIR** / filing no. / full-text over order text | one endpoint, 40+ facets | **not called** — matter intake is free-text CNR only (landing page promises "search by party name" — unbuilt) |
| **Order / judgment documents** | signed **PDF** + **OCR markdown** + vendor AI-analyzed markdown | **not called** — synced orders are plain text with a URL that isn't even a link; nothing downloaded/ingested |
| **Bulk refresh** (≤50 CNRs/call, ~30s, built for nightly jobs) | yes | faked + unused; cron loops single GETs |
| Async refresh (queue + poll) | `POST /case/{cnr}/refresh` | **not used** — synchronous single GET only |
| Court-structure enums (free) | state→district→court hierarchy | **not called**; forum is regex-guessed |

Coverage ceiling (for scoping): SC, all High Courts, district, NCLT/NCLAT, DRT, ITAT, consumer —
but **family / labour / RERA / CAT / NGT are not yet covered**, and the API is **poll-only (no
webhooks)** and **read-only (no e-filing write-back)**. These bound how far "100%" can go.

## Part 3 — The critical finding: the agent loop is off

Everything needed for agent-driven court workflow is in the repo **except the one wire that starts
it**:
- `orchestrator.ts` defines `runAmbient(event)` and an `AmbientEventSchema` with
  `type: "ecourts.synced"` (`{matter_id, activity_ids}`).
- Agents (`intake-registrar`, `court-scout`, `limitation-clerk`) exist and subscribe to events.
- **But `sync.ts` never calls `runAmbient`.** A court sync writes deterministic Inbox rows and
  stops. No agent ever sees a court event.

Fixing this one call (P0 below) is what converts eCourts from "notifications" into "an agent that
does the work."

## Part 4 — The leverage plan: eCourts is the sensor, agents are the workers

The model: **eCourts senses reality → an ambient agent turns each change into a cited proposal →
the lawyer approves.** Map every capability to an agent that produces a *finished* piece of work:

| eCourts capability | Agent | Completed workflow (lawyer just approves) |
|---|---|---|
| Sync diff (have it) | **Court Scout** | "Status → *Arguments*: your evidence stage closed. Prep note attached." — meaning, not a raw diff |
| **Cause lists** (free) | **Hearing-Prep** | 8:30 IST morning board across all your courts, each hearing matched to a matter with a prep pack |
| **Order/judgment PDF + OCR** | **Intake Registrar** | Every synced order → span-cited **facts** on the timeline → the citation ledger (our differentiator) |
| Order/decree **dates** | **Limitation Clerk** | Deterministic appeal/limitation deadline with a computation trace (rule engine, not the LLM) |
| Status / stage change | **Client Herald** | Draft plain-language, per-sentence-cited client update |
| **Search by party / FIR** | **Intake** | Paste an FIR or party name → the matter is found, created, and put under monitoring |
| Acts & sections, IAs, **connected cases** (dropped) | Court Scout / Research | Richer record; "a connected matter was listed"; grounded answers |

**The daily litigator loop, agent-driven:**
1. **Monitor** — sync + Court Scout interpretation *(needs the P0 wire)*.
2. **Prep** — cause-list board + an order-grounded hearing brief.
3. **Attend** — human (court side).
4. **Record outcome** — Outcome Scribe (2 lines → fan-out); the next sync auto-updates the next date.
5. **Deadline** — Limitation Clerk from the order/decree date.
6. **Client update** — Client Herald from the status change.
7. **Next filing** — Drafting Junior produces the *draft*; **filing itself stays manual** (read-only API).

## Part 5 — The honest ceiling

eCourts can drive ~100% of the **read / monitor / prep / advise / deadline / client-update / draft**
loop — everything that happens at the desk. It **cannot** do the write side: **no e-filing**
(read-only), **not real-time** (poll-only, ~nightly + on-demand refresh), and **no coverage** of
family/labour/RERA yet. And the vendor already sells an **AI order-summary** — we should OCR + ground
orders *ourselves* into the citation ledger (our moat), not consume their opaque summary. So the
realistic target is **~90% of desk work, agent-proposed, lawyer-approved** — the last mile is the
lawyer physically filing/appearing, which is correct for a legal product (approve-before-act).

## Part 6 — Prioritized roadmap ("utilise it better")

- **P0 — Turn the loop on (nearly free).** Call `runAmbient({type:"ecourts.synced", matter_id,
  activity_ids})` from `sync.ts` after it writes. Court Scout then interprets every sync into a cited
  proposal. This flips the entire agent value on with one wire.
- **P1 — Cause lists (free, highest ROI).** Add `causelist` calls → a Court Scout "morning board"
  across the lawyer's courts + auto hearing-prep tasks. Zero marginal API cost.
- **P2 — Order ingestion → the grounding bridge.** Download `orderUrl` PDFs to `case-documents`,
  OCR them, run Intake Registrar → span-cited facts → citation ledger. Also feed order/decree dates
  to the Limitation Clerk. This is where eCourts meets the AI differentiator.
- **P3 — Search-driven intake.** Add `/search` (party/FIR/filing) so a matter is created from what
  the lawyer actually has, fulfilling the landing-page promise.
- **P4 — Reliability & cost.** Real bulk-refresh + async queue/poll (per `docs/ARCHITECTURE.md`), a
  single shared daily-spend budget, remaining-credit + staleness (amber) visibility, and
  per-lawyer credentials when multi-tenant billing matters.
- **Cross-cutting — stop losing data.** Store the raw response (`raw_response jsonb`) and widen
  `RawCaseData`/`normalize` so acts/IAs/advocates/connected-cases/FIR aren't discarded (today they're
  unrecoverable without re-billing).

## Part 7 — Verdict

Depth today: **~2/10** — one endpoint, a slim field subset, deterministic notifications, agent loop
off. The gap to "agents do ~100% of the workflow" is **mostly wiring and exploitation of
already-available (often free) capabilities, not new infrastructure**: flip on `runAmbient`, pull
cause lists, ingest orders into the grounding layer. Do P0–P2 and eCourts stops being a status
feed and becomes the engine that hands the lawyer finished, cited work to sign.
