---
date: 2026-06-19
topic: architecture-ideas-from-legal-systems
status: research — not yet decided
method: 8-lane parallel research workflow + synthesis + adversarial critique
---

# Architectural Ideas from Case/Legal Management Systems

Research into how mature case- and legal-management products are built, distilled into
architectural ideas for Legal Owl. Produced by fanning out 8 web-research lanes (mainstream
platforms, legal data modeling, event-sourcing/timeline, court-data sync, case-grounded RAG,
client portals, Indian legal-tech, background jobs), synthesizing into an opinionated proposal,
then running an adversarial scope-guard over it.

> **How to read this doc:** Section 0 is the reconciled, decision-ready summary — start there.
> Sections 1–5 are the full researched proposal. Section 6 is the adversarial critique that
> corrected it. Where they conflict, **Section 0 / the critique wins** — the proposal over-built
> for Phase 1 by ~30–40%.

---

## 0. Decision-ready summary (start here)

### The 5 decisions worth locking in now

1. **Append-only `court_events` + `remarks` as two tables, merged via a `UNION ALL` view** — NOT
   event sourcing, NOT a trigger-based audit sidecar. This is the spine. The sync job writes only
   `court_events`; the notes UI writes only `remarks`; they have different mutability and
   client-visibility postures, so DB-enforced separate schemas are correct. (Validated by the
   GitHub/Linear two-table-merge pattern and Smokeball's activity timeline.)

2. **CNR as a `NOT NULL` primary aggregate key on every row** — every Event, Remark, Order carries
   `cnr`. No forum abstraction, no nullable identifiers in Phase 1. Phase 1 is district courts only;
   add `forum_type` / tribunal identifiers when you actually serve those forums.

3. **`source_type` on Event (`ecourt | lawyer_manual | system`) and `source` on Document
   (`ecourt_order | lawyer_upload | generated`)** — the only two "lay it now" fields that earn their
   place. They are the real client-visibility boundary and AI-grounding boundary, and are genuinely
   free to add now / costly to retrofit. Everything else on the proposal's "free now" list is deferred.

4. **Naive per-case sync on a durable schedule** — use a Postgres-native queue (Graphile Worker) for
   *schedule reliability*, plus `last_successful_sync_at` on Case + a staleness banner, plus
   `raw_response` JSONB on every SyncRun (replayable, defensible audit of what the portal returned).
   Drop cause-list fan-out, DLQ, and cursor-resume until there's a measured need.

5. **Bulk CNR import + a Case lifecycle state (`pending_first_sync | active | not_found | disposed`),
   hosted in an Indian region under DPDPA.** This is the most important *missing* decision: bulk
   import is the actual Excel-replacement onramp (the strategy's core bet), the lifecycle state models
   the unhappy path (eCourts can't resolve a CNR / returns partial data), and data-residency is a
   Phase-1 compliance constraint, not a Phase-2 feature.

### One-line verdict
The spine (append-only events + CNR key + `source_type`) is right. The batch-engine heroics, the
party-CRM normalization, the multi-forum generalization, and the bi-temporal axis are Phase-2
cosplay. The two things a solo lawyer actually needs on day one — **bulk Excel/CNR import** and a
credible **India-data-residency + RLS** story — were missing from the proposal and matter most.

### Don't do this (scope traps)
- Don't build full event sourcing (event store, projections, snapshots, replay infra).
- Don't model 60+ entities like Litify — Phase 1 is 6–8 tables.
- Don't build a generic custom-field engine (Clio took years) — hardcode the Indian district-court
  schema with a `custom_fields` JSONB overflow column.
- Don't import billing-centric activity types (TimeEntry/ExpenseEntry) — invoicing is out of strategy scope.
- Don't scrape eCourts directly — use the aggregator API; record `data_source` to allow migration.
- Don't store parties/court/acts as free-text strings on Case (kills grouping/filtering) — but also
  don't build a Contact+CaseParty CRM in Phase 1 (see critique). Use JSONB on Case, normalize later
  from the `raw_response` you already keep.
- Don't add a `client_visible` boolean — use content-type exclusion (the client API simply has no
  Remarks endpoint).
- Don't let users edit `next_hearing_date` directly — it's a projection written only by the sync job.
- Don't build a webhook/internal event bus or transactional outbox before the notification track exists.
- Don't activate the AI assistant before the case-management data model is clean and populated —
  grounding on a half-built matter layer produces the exact hallucination the core bet exists to prevent.
- Don't use Redis as the only job store (crash-before-flush loses queued syncs = missed hearing = liability).

---

## 1. Full proposal — Executive summary

- **The append-only Event log is the spine of the entire product.** Court Events and lawyer Remarks
  are two append-only tables merged at read time via `UNION ALL` — not event sourcing, not a
  trigger-based audit layer. Every other track (notifications, client portal, AI grounding) consumes
  from it.
- **CNR is the aggregate root key and the client-safe public identifier.** Its 4-char prefix encodes
  State>Complex, so court hierarchy is derivable, not redundantly stored.
- **`next_hearing_date` is a denormalized projection written only by the sync job, never the user.**
  The Event log is the source of truth; the live field is a read-optimized cache.
- **Use a PostgreSQL-native job queue (Graphile Worker), not raw cron** — backfill replays a missed
  6PM run; `job_key=(cnr, scheduled_date)` dedups double-fires; no Redis SPOF.
- **Store the raw eCourts API response on every SyncRun** — replay when parsing changes, debugging,
  and a defensible audit trail (NJDG data is demonstrably unreliable: 71% of disposed cases missing orders).
- **Add three free-now / costly-to-retrofit fields:** `Event.source_type`, `Document.source`,
  `forum_type` + nullable `tribunal_case_number` on Case. *(Critique trims the third — see §6.)*
- **Lay the AI grounding foundation now by scoping everything to CNR** — no vector DB yet, just the
  discipline of CNR as the hard isolation boundary.
- **Reserve a `/api/client/*` namespace and a `source_type`-based visibility rule, build nothing
  else for client experience.**

## 2. Per-track recommendations

### Court monitoring
- **Two-tier sync: cause-list fan-out + targeted per-case refresh** (RECAP/CourtListener +
  Docket Alarm). Fetch the daily cause list per district, only `POST /refresh` cases that changed or
  have a hearing within ~48h — cuts refresh credits 60–80% on a 100-case/2-district portfolio.
  *(Critique: premature — start naive, measure, then optimize.)*
- **Graphile Worker (queue), not raw cron** — survives overruns and 6:05PM downtime.
- **SyncRun as a first-class entity with cursor resume + dead-letter queue** — `scheduled_at` +
  `processed_at`, `last_processed_cnr`, `raw_response` JSONB, `failed_cnrs`. *(Critique: keep
  SyncRun + raw_response; drop DLQ/cursor-resume until needed.)*
- **Composite Event key + content hash for idempotency** — `(cnr, event_type, hearing_date, ordinal)`
  + SHA256 of normalized row content; skip write if hash matches (RECAP's sequence-number scheme).
- **Validate enum codes against the free `/enums` endpoint at job start** — the API returns HTTP 200
  + empty results for wrong enum codes; a "ghost sync" is the highest-probability prod failure.
- **Staleness surfacing** — `last_successful_sync_at` on Case + yellow banner when >24h.

### Case management
- **Case = root aggregate keyed on CNR** ("Case" not "matter" — litigation-only, court fields are
  first-class, not custom fields).
- **Unified timeline via `UNION ALL` over `court_events` + `remarks`** projecting
  `occurred_at, kind, display_text, metadata`, `ORDER BY occurred_at`. Cleaner than what Clio/Smokeball
  ship (single mutable activity table).
- **Parties: normalize eCourts strings into a CaseParty junction** (NIEM RoleOf; Litify/LEAP Party
  junction) to unlock "all cases involving advocate X". *(Critique: biggest scope creep — defer; use
  `petitioner`/`respondent`/`advocates` JSONB on Case, normalize later from `raw_response`.)*
- **Court hierarchy as reference seed data, not strings** — seed State>District>Complex>Establishment
  from the free `/court-structure/*` endpoint; FK Case to `establishment_id` (or derive from CNR prefix).
- **Acts/sections as a GIN-indexed JSONB array (Phase 1), normalize later** — Indian lawyers filter
  by act ("all IPC 420 cases"). *(Critique: GIN index premature at solo row counts.)*

### AI document assistant (deferred — foundation only)
- **CNR as the hard retrieval isolation boundary** (Vaquill "the wall is the context"; Harvey per-firm
  bucket isolation) — prevents one client's chunk surfacing for another's query, the worst failure mode.
- **`Document.source` enum from day one** — AI preferentially grounds on official court orders over
  notes (the architectural form of "traceable to real case data").
- **When the track activates (not now):** abstention-first answers with a confidence indicator,
  bounding-box citation anchors, hybrid dense+sparse retrieval (statute/CNR strings need BM25),
  structure-aware chunking by Indian-judgment rhetorical role. Enterprise legal RAG hallucinates
  17–33% (Stanford) — abstention must be a designed output. **Do not build a vector DB / chunking
  pipeline now.**

### Client experience (deferred — cheap hooks only)
- **Reserve `/api/client/*` returning 501, guarded by a client-token middleware stub** (Clio for
  Clients two-surface auth) — makes the portal additive, not a refactor.
- **Content-type exclusion, not a `client_visible` flag** (Filevine ethical-wall-as-type-exclusion) —
  the client API has no Remarks endpoint and never joins Remarks into a client response.
- **When the portal activates:** add a `ClientUpdate` publish entity, scope client JWTs to a `case_id`
  list, project `next_hearing_date` + last order summary as the status display.

## 3. Cross-cutting architecture

### The unified timeline / event model (opinionated)
**Append-only tables with CRUD projections. NOT full event sourcing. NOT a trigger-based audit
sidecar** (those tables *are* the audit trail — a second source of truth only drifts).

| | court_events | remarks |
|---|---|---|
| Written by | sync job (eCourts) | lawyer (manual) |
| Mutability | append-only (facts of record) | append-only + **DB-enforced immutable** |
| Client-visible | yes (public court data) | **never** (work product, BCI Rule 17) |
| Correction | new `data_correction` event referencing original | new remark (never edit) |

- **Shared projection columns:** `case_id, occurred_at timestamptz NOT NULL, source_type, kind,
  display_text, metadata jsonb`. View SELECTs *only* shared columns so schemas can diverge.
- **Immutability enforcement (soft, sufficient):** revoke UPDATE/DELETE on `remarks` from the app DB
  role + a `BEFORE UPDATE OR DELETE` trigger that raises. Ledger anchoring is overkill.
- **Correction pattern:** when eCourts shows a changed value, insert a `data_correction` event
  referencing the original `event_id` — never mutate.
- **Bi-temporal only where it earns its keep:** `recorded_at` alongside `occurred_at` on
  hearing-type events only. *(Critique: premature — `created_at` + `raw_response` already give
  forensic reconstruction; drop it.)*

### Data model refinements
- `source_type` ENUM on Event (the client-visibility + AI-grounding boundary).
- `next_hearing_date`, `last_event_at`, `last_successful_sync_at` denormalized on Case, written only
  by the sync transaction.
- `raw_response` JSONB + `scheduled_at`/`processed_at`/`last_processed_cnr`/`failed_cnrs` on SyncRun.
- `forum_type` ENUM + nullable `cnr` + nullable `tribunal_case_number` on Case. *(Critique: drop —
  contradicts district-courts-only scope; keep CNR NOT NULL.)*
- `source` ENUM on Order/Document.
- Composite BTREE `(case_id, occurred_at DESC)` on both event tables. *(Critique: index when a slow
  query is measurable.)*

### Sync / job architecture
Cron-triggered enqueue → durable Postgres queue → worker. Worker calls eCourts, diffs **field-by-field**
(not full-response hash), appends Events only on meaningful change. **Transactional outbox** on the
Event table for the future notification relay. *(Critique: build the outbox when notifications ship,
not before — it's the proposal contradicting its own §5.)*

### AI-grounding foundation to lay now
Three near-zero-cost, costly-to-retrofit things: (1) CNR as the hard isolation key on every future
chunk; (2) `Document.source` to rank official orders above notes; (3) structured Events + Remarks as
the grounding context (the future RAG context is the *case timeline*, not just PDFs).

## 4. Entity model proposal

**Keep / refine (Phase 1):**
- **Case** — PK `cnr`; `case_type`, `establishment_id` FK, `stage`, `acts_sections` jsonb,
  `next_hearing_date` (projection), `last_event_at`, `last_successful_sync_at`, `custom_fields` jsonb,
  `judge_name` (plain), `lawyer_id` FK. Title auto-composed. *(Critique: drop `forum_type`/tribunal
  fields; store parties as JSONB here, not in a junction.)*
- **Event** (court_events) — append-only; `cnr` FK, `event_type`, `occurred_at`, `source_type` ENUM,
  `display_text`, `payload` jsonb, `source_sync_run_id` FK, `content_hash`.
- **Remark** — append-only + DB-immutable; `cnr` FK, `created_at`, `created_by`, `body`. No
  `client_visible` flag.
- **Lawyer** — auth/user/tenant entity; `lawyer_id` on every table for RLS.
- **SyncRun** — `cnr` (or batch), `triggered_by`, `scheduled_at`, `processed_at`, `status`,
  `raw_response` jsonb, `events_created_count`.
- **Order/Document** — `cnr` FK, `source` ENUM, `name`, `storage_key`, `pdf_url`, `uploaded_at`.

**Add (Phase 1, low cost):**
- **CourtHierarchy reference tables** (states / districts / court_complexes / establishments) — seed
  from free `/court-structure`.
- **enum_cache** (per court complex) — guards silent-empty-result failures.
- *(Proposal also proposed Contact + CaseParty junction — critique defers it. Use party JSONB on Case.)*

**Critique adds to Phase 1:**
- **Case lifecycle state** (`pending_first_sync | active | not_found | disposed`) — models the unhappy path.
- **Bulk-import path** — paste/upload CNRs → enqueue first-sync each → auto-create cases. The primary
  adoption funnel.

**Deferred (design the boundary, don't build):**
- **ClientUpdate** (client-portal publish surface), **Notification** (`lawyer_id, cnr, event_id?,
  type, body_json, created_at, read_at?` + partial index), **DocumentChunk** (CNR-scoped, AI track),
  normalized acts/sections (Phase 2), **TaskTemplate** (out of strategy scope — confirm before
  building), **audit_event** (when portal + DPDPA logging activate).

## 5. Don't do this
*(Promoted to §0 "Don't do this" — see top of doc for the consolidated list.)*

---

## 6. Adversarial critique (scope-guard) — corrections to §1–5

Verdict: strong and well-researched, but **over-built for Phase 1 by ~30–40%**. Several "free now,
costly to retrofit" claims smuggle in complexity that is neither free nor needed yet.

### (a) Over-engineering / scope creep
- **Contact + CaseParty junction is the biggest creep** — it's the seed of a CRM; "all cases by
  advocate X" is invented, not a stated need. Store parties as JSONB on Case; normalize later from
  `raw_response`.
- **`forum_type` + tribunal fields contradict the stated district-courts-only scope.** Keep CNR
  NOT NULL. Add forums when you serve them.
- **Bi-temporal modeling is premature** — `created_at` + `raw_response` already reconstruct history.
- **Two-tier cause-list sync optimizes a credit problem you don't have yet** and adds a whole second
  integration surface. Start naive, measure, then optimize.
- **Transactional outbox + pg_notify is infra for a notification track that doesn't exist** — the
  proposal contradicts its own §5. Build it when notifications ship.
- **GIN indexes, autovacuum tuning, partial indexes on tens-of-rows tables** — index when a slow
  query is measurable.
- **Graphile Worker is the right call but oversold** — at Phase 1 you need "did 6PM run, alert if not"
  (= `last_successful_sync_at` + banner), not a distributed-systems batch engine.

### (b) Missing ideas (more serious than the over-builds)
- **India data residency / DPDPA compliance** — in force, holds litigant PII + work product. Hosting
  region, encryption at rest, access control, retention/erasure are Phase-1 architectural constraints.
- **Excel/CSV bulk import is missing — and it's the single most important onboarding feature.** The
  core bet is "replacing Excel"; a lawyer with 80 cases won't hand-enter them.
- **eCourts CNR-not-found / partial-data handling is unspecified** — need a Case lifecycle state and
  a partial-data UX (NJDG is 71% missing orders).
- **Per-lawyer credit/cost accounting** — track spend per sync/lawyer; add a spend cap to survive a
  retry storm against a flaky portal.
- **Authn/tenancy is asserted, not designed** — pick `lawyer_id` + Postgres RLS and *specify the policy*;
  hand-waving "RLS" ships confidentiality bugs in a confidentiality product.
- **Timezone for "6PM sync" unstated** — pin everything to Asia/Kolkata, store `timestamptz`, render
  IST. Off-by-one here = missed hearing.

### (c) Sequencing — the walking skeleton
1. Case (CNR PK) + Event (append-only) + Lawyer + **RLS policy**.
2. One-case manual sync: `POST /refresh` → field-diff → append Events → update `next_hearing_date` +
   `last_successful_sync_at`. Naive, no/simplest queue.
3. **Bulk CNR import** (the Excel onramp) — feeds #2 in a loop.
4. Unified timeline view (`UNION ALL`) + Remark create.
5. Daily scheduled sync + staleness banner — introduce Graphile Worker here for *schedule durability*.

**Defer:** cause-list fan-out, Contact/CaseParty, transactional outbox, bi-temporal axis, `forum_type`,
all AI/vector work, all client-portal work beyond "never join Remarks into a client query", normalized
acts/sections, Notification table.

**The two "lay it now" claims that survive:** `source_type` on Event and `source` on Document.
