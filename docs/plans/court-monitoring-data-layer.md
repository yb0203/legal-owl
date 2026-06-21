---
date: 2026-06-19
title: Court Monitoring Data Layer
origin: docs/specs/court-monitoring.md
stack: Python 3.12, FastAPI, SQLAlchemy (async), asyncpg, Supabase (Postgres), APScheduler
---

# Court Monitoring Data Layer — Implementation Plan

## Problem Frame

Build the data acquisition layer that automatically fetches and stores district court case data from the eCourtsIndia API. Lawyers register cases; Legal Owl fetches full history on registration, runs a daily 6 PM sync, and supports on-demand manual refresh. Every detected change is stored as a timestamped event; `next_hearing_date` is always current as a dedicated field. This layer is consumed by the case management track — it does not own any display or notification logic.

---

## Architecture Decisions

**FastAPI with async SQLAlchemy.** eCourtsIndia's manual refresh requires polling (up to 15 seconds). An async stack (FastAPI + SQLAlchemy async + asyncpg) keeps polling non-blocking. Supabase hosts the Postgres instance; we connect directly with asyncpg for full SQL control rather than using the Supabase REST client.

**APScheduler for the 6 PM sync.** APScheduler's `AsyncIOScheduler` integrates cleanly into a FastAPI lifespan context, avoiding a separate worker process for Phase 1. The scheduler is wired into app startup and shutdown; the sync job runs `AsyncIOScheduler` in-process.

**Raw response stored as JSONB.** The full eCourtsIndia case detail response is stored in `monitored_cases.raw_response`. This future-proofs change detection: if eCourtsIndia adds fields, we can re-process stored responses without re-fetching.

**Event model over overwrite.** Every field change writes a new `case_events` row with `previous_value`, `new_value`, `detected_at`. `next_hearing_date` is also updated in place on `monitored_cases` on every sync — these are independent, not redundant (see origin R9, R15).

**Assumptions (unconfirmed — verify before production):**
- eCourtsIndia commercial SaaS terms permit use. (see origin: Outstanding Questions)
- `/api/partner/case/{cnr}` returns complete filing history from filing date.
- CNR numbers are stable for the lifetime of a case.
- Credit cost per billed endpoint is within budget. Model at 500/5,000/50,000 registered cases before launch.

---

## Data Schema

Three tables. All use UUID primary keys. All timestamps are `TIMESTAMPTZ`.

```
monitored_cases       — one row per registered case
case_events           — append-only event log, one row per detected change
sync_runs             — audit log of each sync or manual refresh execution
```

### monitored_cases

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `lawyer_id` | UUID NOT NULL | Supabase Auth user ID |
| `cnr` | VARCHAR(16) UNIQUE NOT NULL | Permanent case identifier |
| `state` | VARCHAR(100) | |
| `district` | VARCHAR(100) | |
| `court_complex` | VARCHAR(200) | |
| `establishment` | VARCHAR(200) | |
| `case_type` | VARCHAR(50) | |
| `case_number` | VARCHAR(20) | |
| `filing_year` | INTEGER | |
| `petitioners` | TEXT[] | eCourtsIndia string array |
| `respondents` | TEXT[] | eCourtsIndia string array |
| `advocates` | TEXT[] | |
| `presiding_judge` | VARCHAR(200) | |
| `current_status` | VARCHAR(100) | |
| `next_hearing_date` | DATE | Always current; updated in-place on every sync |
| `case_ai_analysis` | JSONB | Null if eCourtsIndia returns null; never backfilled |
| `raw_response` | JSONB | Full last API response |
| `registered_at` | TIMESTAMPTZ | |
| `last_synced_at` | TIMESTAMPTZ | |
| `has_unread_updates` | BOOLEAN DEFAULT FALSE | Set true on any new event post-registration |

Index: `(lawyer_id, next_hearing_date ASC NULLS LAST)` — supports case list sorted by urgency (R12).

### case_events

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `case_id` | UUID FK → monitored_cases | |
| `cnr` | VARCHAR(16) NOT NULL | Denormalized for fast lookup |
| `event_type` | VARCHAR(50) NOT NULL | See event type enum below |
| `previous_value` | TEXT | Null for first-occurrence events |
| `new_value` | TEXT | |
| `detected_at` | TIMESTAMPTZ NOT NULL | Timestamp of the sync/refresh run |
| `sync_run_id` | UUID FK → sync_runs | |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | |

Index: `(case_id, detected_at ASC)` — supports chronological timeline queries.

**Event type enum** (stored as string):
`hearing_date_changed` · `status_changed` · `order_uploaded` · `judge_changed` · `petitioner_changed` · `respondent_changed` · `advocate_changed` · `case_registered` (first fetch marker)

### sync_runs

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `run_type` | VARCHAR(20) NOT NULL | `scheduled` or `manual` |
| `triggered_by_cnr` | VARCHAR(16) | Null for scheduled; set for manual |
| `started_at` | TIMESTAMPTZ NOT NULL | |
| `completed_at` | TIMESTAMPTZ | |
| `cases_processed` | INTEGER DEFAULT 0 | |
| `cases_changed` | INTEGER DEFAULT 0 | |
| `status` | VARCHAR(20) DEFAULT 'running' | `running` · `completed` · `failed` · `timed_out` |
| `error_detail` | TEXT | |

---

## Implementation Units

Units are ordered by dependency. Each unit ships and is tested before the next begins.

---

### Unit 1 — Database Migrations

**Files:**
- `supabase/migrations/001_monitored_cases.sql`
- `supabase/migrations/002_case_events.sql`
- `supabase/migrations/003_sync_runs.sql`

**What it delivers:** The three tables above with indexes, foreign keys, and row-level security (RLS) policies so each lawyer only sees their own cases.

**RLS policy pattern** (apply to `monitored_cases`):
```sql
CREATE POLICY "lawyers see own cases"
  ON monitored_cases FOR ALL
  USING (lawyer_id = auth.uid());
```
`case_events` and `sync_runs` inherit access via joins, or carry their own `lawyer_id` denormalized if direct queries are needed.

**Test scenarios:** No automated tests for migrations. Manually verify with `supabase db reset` + seed insert that RLS blocks cross-user access.

---

### Unit 2 — Project Scaffolding

**Files:**
- `pyproject.toml` — dependencies: `fastapi`, `uvicorn`, `sqlalchemy[asyncio]`, `asyncpg`, `httpx`, `apscheduler`, `supabase`, `python-dotenv`, `pytest`, `pytest-asyncio`, `respx`
- `app/__init__.py`
- `app/main.py` — FastAPI app + lifespan (scheduler start/stop)
- `app/config.py` — settings from environment: `DATABASE_URL`, `ECOURTS_API_URL`, `ECOURTS_BEARER_TOKEN`, `SYNC_HOUR` (default 18)
- `app/database.py` — SQLAlchemy async engine, `AsyncSession` factory, `get_db` dependency
- `.env.example`

**Test scenarios:** None for scaffolding beyond `pytest` collection passing.

---

### Unit 3 — eCourtsIndia API Client

**File:** `app/clients/ecourts_india.py`
**Test file:** `tests/clients/test_ecourts_india.py`

**What it delivers:** A typed async HTTP client wrapping all eCourtsIndia endpoints used in Phase 1. All calls go through this client — no other module imports `httpx` directly.

**Interface (methods):**
- `get_court_structure(path: str) -> dict` — free, no auth
- `get_enums() -> dict` — free, no auth
- `search_cases(query: SearchParams) -> list[CaseSearchResult]` — billed
- `get_case_detail(cnr: str) -> CaseDetail` — billed
- `refresh_case(cnr: str) -> RefreshResponse` — billed, async trigger
- `bulk_refresh(cnrs: list[str]) -> BulkRefreshResponse` — billed, async trigger, max 50

**Internals:**
- `Authorization: Bearer {ECOURTS_BEARER_TOKEN}` header injected on every billed call.
- On `429` response: read `retry-after` header, sleep, retry once. If second attempt also 429, raise `RateLimitError`.
- Request timeout: 20 seconds default.
- All responses deserialized into dataclasses/Pydantic models — no raw dict leakage.

**Test scenarios (use `respx` to mock HTTP):**
1. `get_case_detail` with a valid CNR returns a populated `CaseDetail` object.
2. `get_case_detail` on a 429 response retries after `retry-after` seconds; succeeds on retry.
3. `get_case_detail` on a second consecutive 429 raises `RateLimitError`.
4. `search_cases` with petitioner name returns a list of `CaseSearchResult` items.
5. `bulk_refresh` with 50 CNRs sends exactly one request; with 51 CNRs raises `ValueError`.
6. Auth header is present on all billed endpoints and absent on free endpoints.
7. `get_case_detail` on network timeout raises `httpx.TimeoutException` (not swallowed).

---

### Unit 4 — Court Hierarchy Service

**File:** `app/services/court_hierarchy.py`
**Test file:** `tests/services/test_court_hierarchy.py`

**What it delivers:** Thin service over `ecourts_india.get_court_structure(...)`. Returns navigable hierarchy lists (states, districts given state, court complexes given district, establishments given complex). Results are cached in-process for the session lifetime (court structure is stable; no cache invalidation needed for Phase 1).

**API routes (in `app/routers/court_hierarchy.py`):**
- `GET /court-structure/states`
- `GET /court-structure/districts?state_code=...`
- `GET /court-structure/complexes?district_code=...`
- `GET /court-structure/establishments?complex_code=...`
- `GET /enums/case-types`

**Test scenarios:**
1. States endpoint returns a non-empty list with `code` and `name` fields.
2. Districts endpoint for a known state code returns districts.
3. Cache hit: second call to states does not call the API client.
4. API client error propagates as a 502 response.

---

### Unit 5 — Change Detection

**File:** `app/services/change_detection.py`
**Test file:** `tests/services/test_change_detection.py`

**What it delivers:** Pure function (no DB calls) that diffs a stored case state against a new `CaseDetail` API response and returns a list of `CaseEvent` objects to be written. This is the core correctness logic of the whole layer.

**Interface:**
```python
def detect_changes(
    stored: StoredCaseState,
    fresh: CaseDetail,
    detected_at: datetime,
    sync_run_id: UUID,
) -> tuple[list[CaseEvent], UpdatedFields]:
```

`StoredCaseState` is a flat view of the `monitored_cases` row (typed dataclass). `UpdatedFields` is the set of fields that need to be written back to `monitored_cases` (e.g. `next_hearing_date`, `current_status`).

**Fields compared:** `next_hearing_date`, `current_status`, `presiding_judge`, `petitioners` (as sorted set), `respondents` (as sorted set), `advocates` (as sorted set), order list length (for `order_uploaded` events).

**Test scenarios:**
1. No fields changed → returns empty event list.
2. `next_hearing_date` changed from 15 Jul to 22 Jul → one `hearing_date_changed` event with correct `previous_value` and `new_value`; `UpdatedFields` includes new date.
3. `current_status` changed → one `status_changed` event.
4. Two fields changed in one response → two events.
5. New order in order list → one `order_uploaded` event with filename in `new_value`.
6. Judge changed → one `judge_changed` event.
7. First fetch (no stored state) → `case_registered` marker event; `previous_value` is null for all initial-state events.
8. `next_hearing_date` null in API response and null in stored state → no event.

---

### Unit 6 — Case Registration Service

**File:** `app/services/case_registration.py`
**Test file:** `tests/services/test_case_registration.py`

**What it delivers:** Orchestrates the full registration flow — both the search path and the direct hierarchy path converge here. On registration: fetches full case detail, creates `monitored_cases` row, calls `change_detection.detect_changes` with no stored state to generate the initial history events, writes all events, creates a `sync_runs` record for the registration fetch.

**Interface:**
```python
async def register_case(cnr: str, lawyer_id: UUID, db: AsyncSession) -> RegisteredCase
```

Precondition check: if CNR already exists for this `lawyer_id`, return the existing record (idempotent).

**API routes (in `app/routers/cases.py`):**
- `POST /cases/search` → calls `ecourts_india.search_cases`, returns list of matches (no DB write)
- `POST /cases/register` body: `{ cnr: str }` → calls `register_case`, returns case record

**Test scenarios:**
1. Registering a new CNR creates one `monitored_cases` row and one `sync_runs` row.
2. Historical events from a multi-year case (simulated via mock response with 12 past hearings) produce 12+ `case_events` rows.
3. `next_hearing_date` on `monitored_cases` matches the date in the API response after registration.
4. `has_unread_updates` is `False` after registration (first fetch is silent, per R19).
5. Re-registering the same CNR for the same lawyer returns the existing record without duplicating rows.
6. Re-registering the same CNR for a *different* lawyer creates a second `monitored_cases` row (each lawyer has their own record).
7. If the eCourtsIndia API call fails, no rows are written (transaction rolled back).
8. `case_ai_analysis` is stored when non-null in API response; `null` column value when null.

---

### Unit 7 — Sync Service

**File:** `app/services/sync_service.py`
**Test file:** `tests/services/test_sync_service.py`

**What it delivers:** The scheduled daily 6 PM sync. Fetches all registered CNRs, batches into groups of ≤50, calls `bulk_refresh`, polls for results, runs change detection per case, writes events, updates `next_hearing_date` and `has_unread_updates`.

**Interface:**
```python
async def run_scheduled_sync(db: AsyncSession) -> SyncSummary
```

**Polling strategy:** After `bulk_refresh`, poll `get_case_detail(cnr)` for each CNR in the batch every 2 seconds, up to 30 seconds total before marking that case's sync result as unavailable and moving on. (Bulk refresh results are typically available in 5-10 seconds per eCourtsIndia docs.)

**Batching:** If `len(all_cnrs) > 50`, split into sequential batches. Rate-limit headroom: 50,000 req/day; 500 cases = 10 bulk refresh calls + ~500 polling calls = well within limits.

**Test scenarios:**
1. With 3 registered cases, sync creates one `sync_runs` row covering all 3.
2. Case with changed `next_hearing_date` gets a `case_events` row and updated `next_hearing_date` on `monitored_cases`.
3. Case with no changes: no `case_events` row written; `next_hearing_date` still updated in place.
4. `has_unread_updates` set to `True` only on cases with new events.
5. 51 registered cases → two bulk refresh calls (batches of 50 and 1).
6. If `bulk_refresh` returns 429, the sync logs the error to `sync_runs.error_detail` and continues with remaining batches rather than aborting.
7. Case polling that times out (no result in 30s) is skipped and counted in `sync_runs` without raising.

---

### Unit 8 — Manual Refresh

**File:** `app/services/manual_refresh.py`
**Test file:** `tests/services/test_manual_refresh.py`

**What it delivers:** On-demand single-case refresh. Calls `refresh_case(cnr)`, then polls `get_case_detail(cnr)` every second, runs change detection, writes events, updates fields. Target: under 6 seconds. Hard timeout: 15 seconds, after which a `timed_out` `sync_runs` row is written and the lawyer is informed.

**Interface:**
```python
async def refresh_case_now(cnr: str, lawyer_id: UUID, db: AsyncSession) -> RefreshResult
```

**API route:** `POST /cases/{cnr}/refresh` — returns `RefreshResult` with `status` (`completed` | `timed_out`), `events_detected` count, and `next_hearing_date`.

**Test scenarios:**
1. Refresh completes in <6 seconds → `status: completed`, new events written.
2. Refresh completes with no changes → `status: completed`, `events_detected: 0`, `next_hearing_date` updated.
3. eCourtsIndia does not respond within 15 seconds → `status: timed_out`, no DB writes to case data, `sync_runs` row with `status: timed_out`.
4. Lawyer cannot refresh a CNR they don't own → 403 response.
5. `has_unread_updates` set to `True` if events detected.

---

### Unit 9 — Scheduler Wiring

**File:** `app/scheduler.py`
**Integration test:** `tests/test_scheduler_integration.py`

**What it delivers:** `APScheduler AsyncIOScheduler` configured to call `run_scheduled_sync` daily at `SYNC_HOUR:00` in the `Asia/Kolkata` timezone. Wired into FastAPI's lifespan context (`startup` starts scheduler, `shutdown` shuts it down cleanly).

**Test scenarios:**
1. Scheduler starts on app startup and is accessible via `app.state.scheduler`.
2. Manually triggering the sync job via `scheduler.get_job(...).func()` runs without error.
3. Scheduler shuts down cleanly on app shutdown (no pending job warnings in logs).

---

## Sequencing

```
Unit 1  (schema)
  └─► Unit 2  (scaffolding)
        └─► Unit 3  (API client)
              ├─► Unit 4  (court hierarchy)   — can be built and tested independently after Unit 3
              ├─► Unit 5  (change detection)  — pure logic, no DB; can be built after Unit 3
              └─► Unit 6  (registration)      — needs Units 3, 5
                    └─► Unit 7  (sync)        — needs Units 3, 5, 6
                          └─► Unit 8  (manual refresh)  — needs Units 3, 5
                                └─► Unit 9  (scheduler) — needs Unit 7
```

Units 4 and 5 can be worked in parallel after Unit 3. Units 7 and 8 can be worked in parallel after Unit 6.

---

## API Surface Summary

All routes are under `/api/v1`. Auth via Supabase JWT (`Authorization: Bearer <supabase-token>`).

| Method | Path | Unit | Notes |
|---|---|---|---|
| `GET` | `/court-structure/states` | 4 | Free, cached |
| `GET` | `/court-structure/districts` | 4 | Free, cached |
| `GET` | `/court-structure/complexes` | 4 | Free, cached |
| `GET` | `/court-structure/establishments` | 4 | Free, cached |
| `GET` | `/enums/case-types` | 4 | Free, cached |
| `POST` | `/cases/search` | 6 | Billed; no DB write |
| `POST` | `/cases/register` | 6 | Billed; creates case + events |
| `GET` | `/cases` | 6 | Lawyer's cases, sorted by `next_hearing_date` |
| `GET` | `/cases/{cnr}` | 6 | Case detail + event list |
| `POST` | `/cases/{cnr}/refresh` | 8 | Billed; polls up to 15s |
| `POST` | `/sync/run` | 7 | Internal/admin — triggers sync manually |

---

## Risks and Mitigations

**eCourtsIndia API terms unconfirmed.** The ToS must permit commercial SaaS use before production launch. Engage eCourtsIndia before writing a line of client code. If terms block SaaS, the data layer needs an in-house scraping approach — scope creep of several weeks.

**Credit cost unknown.** Build the client with per-request logging (endpoint, timestamp, response status) from day one. This gives a real cost baseline before bill arrives. Model cost at 500/5,000/50,000 cases using the credit cost once confirmed.

**`/api/partner/case/{cnr}` history depth unverified.** Test with a real multi-year case during development (AE1 in the brainstorm). If the API returns only recent events (e.g., 6-month window), the initial registration fetch is incomplete and the requirements need revision.

**APScheduler in-process for Phase 1.** If the FastAPI process restarts mid-sync, the in-flight job is lost. Acceptable for Phase 1 with a small case portfolio. When case count grows or reliability matters, migrate to Celery + Redis or a separate cron trigger calling the `/sync/run` endpoint.

**Supabase RLS policy coverage.** All three tables need RLS enabled with correct policies before any real lawyer data is stored. Test RLS explicitly in Unit 1 verification — cross-user access is a hard data privacy requirement.

---

## Outstanding Questions (Deferred to Implementation)

- Exact eCourtsIndia field names in the case detail response — map during Unit 3 against a live API response.
- Whether `order_uploaded` events carry a filename or just a count — drives `new_value` format in change detection.
- Supabase project setup (region, connection pooling via PgBouncer vs direct connection) — resolve before Unit 1.
- Error response format from eCourtsIndia (structured JSON vs plain text) — drives `RateLimitError` and general error handling in Unit 3.
