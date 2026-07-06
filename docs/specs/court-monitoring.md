---
date: 2026-06-17
topic: court-monitoring-data-layer
---

# Court Monitoring Data Layer — Requirements

## Summary

A data acquisition layer that automatically fetches and tracks court case events for district courts. Lawyers register a case either by directly entering court hierarchy details or by searching using party or advocate names. Legal Owl fetches the full available case history immediately on registration, then syncs once daily at 6 PM and on demand via manual refresh. Every detected change is stored as a timestamped event; the next hearing date is always maintained as a dedicated field. Phase 1 covers data acquisition only — display, notifications, and UI are out of scope for this document.

---

## MVP scope note (2026-07-06) — CNR-first registration is what shipped

What's actually built for "New matter" is narrower than the two registration paths designed below,
and deliberately so: the lawyer enters the **CNR only**. Legal Owl fetches the case
(`GET /api/partner/case/{cnr}`), shows a confirm card (parties, forum, case type, current status) so
the lawyer can verify it's the right case, and only then creates the matter — pre-filled from the
fetch, with the lawyer adding just the internal Title and Client. See **F0** below.

**Known gap, tracked for later (not in this experience yet):** a lawyer who does not already have the
CNR has no way to find their case in the product today. Both of the richer paths documented as F1
(search by party/advocate name) and F2 (direct court-hierarchy entry: State → District → Court
Complex → case type → number → year, with cascading dropdowns off the free court-structure/enum
endpoints) were designed and partially prototyped, then deliberately shelved out of the MVP —
`/api/partner/search`'s exact field-level behavior for a hierarchy-style lookup was still pending
live verification, and the CNR-first path removes that uncertainty entirely for launch. F1/F2 remain
the intended design for that gap; revisit them once CNR-first registration is validated with real
lawyers who hit this wall.

- F0. **CNR-direct registration (MVP, shipped)**
  - **Trigger:** Lawyer has the CNR and creates a new matter.
  - **Actors:** A1, A2
  - **Steps:** Lawyer enters the 16-character CNR. Legal Owl calls `/api/partner/case/{cnr}` and shows
    parties, forum, case type, and current status for confirmation. Lawyer confirms (editing the
    Title if needed, optionally linking a Client). Legal Owl creates the matter and immediately
    kicks off a full sync (history, `next_hearing_date`, timeline).
  - **Covers:** R6, R7, R8, R9, R19 (not R1–R5 — no search or hierarchy-entry step exists yet)
  - **Fallback:** if eCourts isn't reachable/configured, or the lawyer doesn't have a CNR, they use
    the plain manual entry form (title/forum/case type/parties typed by hand, CNR optional).

---

## Problem Frame

Lawyers currently monitor case progress by manually checking the eCourts portal, maintaining Excel sheets with case status, and sending manual client updates. The court portal requires navigating a four-level hierarchy and solving CAPTCHA on every search. For a solo lawyer managing 20–50 active cases, this is a significant daily time drain.

The court monitoring track eliminates this by pulling court data automatically into Legal Owl. This document covers Phase 1: district courts only.

---

## API Reference — eCourtsIndia

Legal Owl uses the eCourtsIndia API (`webapi.ecourtsindia.com`) as its data source for Phase 1. All endpoints require a Bearer token (`Authorization: Bearer eci_live_...`) except court structure and enum lookups.

| Method | Endpoint | Purpose | Billed |
|--------|----------|---------|--------|
| GET | `/api/partner/case/{cnr}` | Full case detail by CNR | Yes |
| GET | `/api/partner/search` | Case search by name, advocate, court, type, date | Yes |
| POST | `/api/partner/case/{cnr}/refresh` | Queue a single-case rescrape (async) | Yes |
| POST | `/api/partner/case/bulk-refresh` | Queue up to 50 cases for rescrape (async) | Yes |
| GET | `/api/partner/case/{cnr}/order/{filename}` | Order PDF metadata | Yes |
| GET | `/api/partner/causelist/court-structure/*` | Court hierarchy navigation | Free |
| GET | `/api/partner/enums` | Live enum reference (case types, statuses) | Free |

**CNR format:** 16-character alphanumeric — `[4-letter court code][6-digit case number][4-digit filing year]`. Example: `DLHC010001232024`.

**Rate limits:** 100 requests/min · 3,000/hr · 50,000/day · 10 concurrent max. Exceeding limits returns `429` with a `retry-after` header.

**Async refresh behaviour:** Single and bulk refresh calls are asynchronous. eCourtsIndia queues the rescrape and results are typically available within 5–10 seconds. Legal Owl polls for completion rather than blocking.

**Pricing:** Credit-based, pay-per-request. ₹200 free credits on signup. Exact credit cost per endpoint to be confirmed with eCourtsIndia before production use. Court structure and enum endpoints are free.

**Search parameters (`/api/partner/search`):** `query` (full-text), `petitioners`, `respondents`, `advocates`, `judges`, `courtCodes`, `caseTypes`, `caseStatuses`, `filingDateFrom/To`, `decisionDateFrom/To`. Pagination: `page`, `pageSize` (max 100). Returns CNR, parties, advocates, judges, and case metadata per result.

---

## Key Decisions

- **Third-party API for Phase 1.** The eCourts portal requires CAPTCHA on all searches. Building a reliable in-house scraping layer is weeks of engineering with ongoing maintenance. eCourtsIndia provides structured JSON access to 700+ district courts, 25 High Courts, and the Supreme Court with no CAPTCHA. Legal Owl uses this for Phase 1 and revisits in-house data fetching in Phase 2 or 3 as usage volume makes costs meaningful.

- **Activity timeline plus persistent next hearing date.** Every detected change is stored as a timestamped event for full audit history. Additionally, `next_hearing_date` is maintained as a dedicated field on the case record — always current, updated on every sync — because lawyers need to see it at a glance without parsing event history.

- **Two registration paths.** Lawyers who know their case number use the direct hierarchy entry path. Lawyers who only know the party name or advocate name use the search path, which queries the eCourtsIndia search endpoint and lets them select the correct case from results before registering it.

- **Once-daily sync at 6 PM.** Court portals typically update in the evening after that day's hearings conclude. A single daily sync at 6 PM captures the day's changes. Manual refresh is available at any time for cases where the lawyer needs fresh data immediately.

- **Data acquisition only in Phase 1.** How court data surfaces in the UI — case page, activity feed, dashboard — is a separate product decision not resolved here. Phase 1 delivers a reliable, queryable data layer.

- **Phased court coverage.** District courts ship in Phase 1. High Courts (24 separate portals, no uniform API) are Phase 2. Supreme Court (sci.gov.in, automated access blocked) is Phase 3. eCourtsIndia covers all three tiers, so the API integration does not change across phases — only scope expands.

- **No notification on first fetch.** The initial registration fetch populates full history silently. Notifications only fire when a subsequent sync detects a new change.

---

## Actors

- A1. **Lawyer** — registers cases for monitoring, triggers manual refreshes, and searches for cases by name.
- A2. **eCourtsIndia API** — external data source; returns structured case data by CNR or search query.
- A3. **Sync service** — scheduled background job that runs the daily bulk refresh and change detection.

---

## Requirements

**Case search (without CNR)**

- R1. A lawyer who does not know the CNR number can search for a case by entering one or more of: petitioner name, respondent name, advocate name, along with optional filters for court, case type, and year.
- R2. Search calls the eCourtsIndia `/api/partner/search` endpoint and returns a list of matching cases with CNR, parties, court, and current status.
- R3. The lawyer selects the correct case from results; the selected case's CNR and metadata pre-fill the registration form.

**Case registration**

- R4. A lawyer who knows their case details can register directly by navigating the four-level district court hierarchy: State → District → Court Complex → Establishment, then providing case type, case number, and year.
- R5. The court hierarchy dropdowns are populated from the free eCourtsIndia court structure endpoint — no credits consumed.
- R6. On submission (via either path), Legal Owl immediately calls `/api/partner/case/{cnr}` to fetch the full available case history — all past hearing dates, orders, and status changes since the case was filed.
- R7. The CNR number is stored as the permanent identifier for all subsequent monitoring of that case.

**Data stored per case**

- R8. The case record stores: CNR number, court hierarchy (state, district, court complex, establishment), case type, case number, year, party names, advocate names, presiding judge, current status, and `next_hearing_date`.
- R9. `next_hearing_date` is a dedicated persistent field on the case record — always set to the most recent value returned by the API, updated on every sync and every manual refresh.
- R10. Each event record stores: event type, previous value, new value, timestamp the change was detected, and which sync or refresh run detected it.

**Sync and change detection**

- R11. The sync service runs once daily at 6 PM for all registered cases, using the eCourtsIndia bulk refresh endpoint (up to 50 cases per request).
- R12. After queuing the bulk refresh, the sync service polls eCourtsIndia for results and processes responses as they become available.
- R13. Each sync compares newly fetched data against the last stored state and writes a new event record for every field that changed.
- R14. Events tracked include: next hearing date set or changed, hearing date passed (case called), case status change, new order or judgement uploaded, judge assignment change, and any other field change returned by the API.
- R15. `next_hearing_date` on the case record is updated in place on every sync regardless of whether a change event is written.

**Manual refresh**

- R16. A lawyer can trigger a manual refresh for a specific case at any time.
- R17. Legal Owl calls `/api/partner/case/{cnr}/refresh`, then polls for the result every second. New events are written and `next_hearing_date` is updated as soon as the response is available, targeting under 6 seconds from the lawyer's tap to data being updated.
- R18. If eCourtsIndia has not returned a result within 15 seconds, the refresh is marked as timed out and the lawyer is informed to retry.

**Notifications**

- R19. The initial registration fetch does not trigger any notification — data is populated silently.
- R20. Subsequent syncs and manual refreshes that detect at least one new event mark the case as having unread updates. Notification delivery (in-app, email, push) and configuration are deferred to the notification system brainstorm.

**Court coverage — phased**

- R21. Phase 1: district courts via eCourtsIndia API. Case identifier: CNR (16-character). Court hierarchy: State → District → Court Complex → Establishment.
- R22. Phase 2: High Courts. 24 courts accessed via hcservices.ecourts.gov.in with state code and court code. eCourtsIndia covers all 25 High Courts; integration approach and additional court-specific fields to be determined in Phase 2 planning.
- R23. Phase 3: Supreme Court. Portal at sci.gov.in blocks automated access. Data access strategy unresolved — options include eCourtsIndia's Supreme Court coverage, official NJDG partnership, or in-house approach.

---

## Key Flows

- F1. **Case search and registration (search path) — deferred beyond MVP, see the scope note above**
  - **Trigger:** Lawyer does not know the CNR and chooses to search.
  - **Actors:** A1, A2
  - **Steps:** Lawyer enters party name, advocate name, or both with optional filters. Legal Owl calls `/api/partner/search`, displays results. Lawyer selects the correct case. CNR and metadata pre-fill the registration form. Lawyer confirms. Legal Owl fetches full history via `/api/partner/case/{cnr}`, stores events and `next_hearing_date`, marks as registered.
  - **Covers:** R1, R2, R3, R6, R7, R8, R9, R19

- F2. **Direct case registration (hierarchy path) — deferred beyond MVP, see the scope note above**
  - **Trigger:** Lawyer knows case number and court details.
  - **Actors:** A1, A2
  - **Steps:** Lawyer selects state → district → court complex → establishment (dropdowns from free court structure endpoint) → case type → case number → year. Legal Owl fetches full history via `/api/partner/case/{cnr}`, stores events and `next_hearing_date`, marks as registered.
  - **Covers:** R4, R5, R6, R7, R8, R9, R19

- F3. **Scheduled daily sync**
  - **Trigger:** Sync service fires at 6 PM daily.
  - **Actors:** A2, A3
  - **Steps:** Sync service batches all registered cases in groups of ≤50, calls bulk refresh, polls for results, runs change detection per case, writes new event records for changed fields, updates `next_hearing_date` in place, marks cases with changes as having unread updates.
  - **Covers:** R11, R12, R13, R14, R15, R20

- F4. **Manual refresh**
  - **Trigger:** Lawyer taps "Refresh" on a specific case.
  - **Actors:** A1, A2, A3
  - **Steps:** Legal Owl calls single-case refresh, polls every second for result, runs change detection, writes new events, updates `next_hearing_date`. Target: data updated within 6 seconds. If no response within 15 seconds, marks as timed out.
  - **Covers:** R16, R17, R18, R13, R14, R15

---

## Acceptance Examples

- AE1. **First fetch includes full history.**
  **Covers R6.** A case filed in 2023 is registered today. The stored event timeline shows all hearing dates, status changes, and orders from 2023 onward, not just today's state.

- AE2. **No notification on registration.**
  **Covers R19.** A lawyer registers five cases in one session. No emails, push notifications, or in-app alerts fire. All five cases show their full history in Legal Owl.

- AE3. **Next hearing date always present.**
  **Covers R9, R15.** A sync runs and the court has rescheduled a hearing. The event record captures the change; `next_hearing_date` on the case record is updated to the new date. Both the event and the field reflect the new value independently.

- AE4. **Change detected on sync.**
  **Covers R13, R14.** A case had next hearing date 15 July. After the 6 PM sync, eCourtsIndia returns 22 July. Legal Owl writes a new event: `type: hearing_date_changed, previous: 2026-07-15, new: 2026-07-22, detected_at: <sync timestamp>`. `next_hearing_date` is updated to `2026-07-22`.

- AE5. **No change on sync.**
  **Covers R13.** A sync runs and eCourtsIndia returns identical data. No new event records are written. The case's last-synced timestamp and `next_hearing_date` update; nothing else changes.

- AE6. **Search finds case without CNR.**
  **Covers R1, R2, R3.** A lawyer enters "Sharma vs State of Delhi" and selects the district court filter. Results show three matching cases with CNR, parties, court, and status. Lawyer selects the correct one; the registration form pre-fills.

- AE7. **Manual refresh times out.**
  **Covers R18.** Lawyer taps Refresh. eCourtsIndia does not respond within 15 seconds. Legal Owl marks the refresh as timed out and surfaces a message to retry. Stored data and `next_hearing_date` remain unchanged.

---

## Scope Boundaries

**Deferred for later**

- Case management dashboard and case page UI — how court events and `next_hearing_date` are displayed is a separate brainstorm.
- Notification delivery system (email, push, in-app configuration) — deferred to notification system brainstorm.
- AI-augmented monitoring (auto-ingesting new court orders into the document assistant) — deferred until AI document assistant track is functional.
- In-house court data fetching layer — revisit at Phase 2 or 3 when usage volume makes eCourtsIndia costs significant.
- High Court integration — Phase 2.
- Supreme Court integration — Phase 3.

**Outside this product's identity**

- Bulk historical import beyond what the court portal already provides.
- SMS or WhatsApp notifications.
- Multi-court linking (one Legal Owl case mapped to multiple court case numbers).

---

## Dependencies and Assumptions

- **eCourtsIndia commercial terms.** Requires review before implementation — the product is a SaaS and the credit-based pricing model must be confirmed as compatible with commercial use at scale.
- **Credit cost per endpoint.** Exact credit cost per API call to be confirmed with eCourtsIndia. The once-daily bulk refresh for 500 cases = 10 bulk requests/day (50 per batch). Manual refreshes are single-case calls billed separately.
- **Full history in single CNR lookup.** Assumes `/api/partner/case/{cnr}` returns complete case history from filing date. To be verified against a real multi-year case during integration.
- **CNR stability.** Assumes the CNR number does not change for the lifetime of a case. To be confirmed against eCourtsIndia documentation.
- **eCourtsIndia AI summaries not consumed.** The API returns AI-generated order summaries per case. Legal Owl does not consume these in Phase 1 to avoid overlap with the AI document assistant track.
- **Rate limits sufficient for Phase 1.** 50,000 requests/day accommodates a portfolio of thousands of cases at the once-daily sync cadence with room for manual refreshes.

---

## Outstanding Questions

**Resolve before planning**

- Exact credit cost per billed endpoint — needed to model operating cost at 500, 5,000, and 50,000 registered cases.
- Are eCourtsIndia's terms of service compatible with commercial SaaS use?
- Does `/api/partner/case/{cnr}` return complete filing history or only recent events? If only recent, what is the lookback window?

**Deferred to planning**

- Sync job infrastructure — cron job, background worker, or queue-based approach for the 6 PM daily run.
- Error handling when eCourtsIndia API is unreachable — retry strategy, stale-data handling, lawyer-facing feedback.
- Data schema — event table structure, indexing for change detection and `next_hearing_date` queries.
- Batching strategy when registered cases exceed 50 (multiple sequential bulk refresh calls vs parallel).
- Rate limit handling if manual refreshes collide with the 6 PM scheduled sync window.
