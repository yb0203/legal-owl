---
date: 2026-06-17
topic: court-monitoring-data-layer
---

# Court Monitoring Data Layer — Requirements

## Summary

A data acquisition layer that automatically fetches and tracks court case events for district courts. Lawyers register a case by providing court hierarchy and case identifiers; Legal Owl fetches the full available case history immediately, then syncs twice daily and on demand. Every detected change is stored as a timestamped event. Phase 1 covers data acquisition only — display, notifications, and UI are out of scope for this document.

---

## Problem Frame

Lawyers currently monitor case progress by manually checking the eCourts portal, maintaining Excel sheets with case status, and sending manual client updates. The court portal requires navigating a four-level hierarchy and entering CAPTCHA on every search. For a solo lawyer managing 20–50 active cases, this is a significant daily time drain.

The court monitoring track eliminates this by pulling court data automatically into Legal Owl. This document covers Phase 1: district courts only.

---

## Key Decisions

- **Third-party API for Phase 1.** The eCourts portal requires CAPTCHA on all searches. Building a reliable in-house scraping layer is weeks of engineering with ongoing maintenance. eCourtsIndia's API (ecourtsindia.com) provides structured JSON access to 600+ district courts with no CAPTCHA, covering all three court tiers. Legal Owl uses this for Phase 1 and revisits in-house data fetching in Phase 2 or 3 as usage volume makes costs meaningful.

- **Activity timeline, not snapshot.** Every detected change is stored as a timestamped event rather than overwriting the previous state. This makes the case record a full audit trail of court activity and sets up the client experience and AI document assistant tracks to consume a rich history rather than a point-in-time snapshot.

- **Data acquisition only in Phase 1.** How court data surfaces in the UI — the case dashboard, activity feed, or case page — is a separate product decision not resolved here. Phase 1 delivers a reliable, queryable data layer. Display is a subsequent brainstorm.

- **Phased court coverage.** District courts ship in Phase 1 via the eCourtsIndia API. High Courts (24 separate portals, no uniform API) are Phase 2. The Supreme Court (sci.gov.in, most restricted access, returns 403 on automated requests) is Phase 3. eCourtsIndia covers all three tiers, so the API integration does not need to change across phases — only scope expands.

- **No notification on first fetch.** The initial case setup fetch populates the full history silently. Notifications only fire when a subsequent sync detects a new change. This prevents a lawyer who links 20 cases at once from receiving 20 notification emails.

---

## Actors

- A1. **Lawyer** — registers cases for monitoring and triggers manual refreshes.
- A2. **eCourtsIndia API** — external data source; returns structured case data by CNR number.
- A3. **Sync service** — scheduled background job that runs bulk refreshes and detects changes.

---

## Requirements

**Case registration**

- R1. The lawyer selects district court and navigates a four-level hierarchy: State → District → Court Complex → Establishment.
- R2. The lawyer provides case type, case number, and year to identify the specific case.
- R3. On submission, Legal Owl immediately fetches the full available case history from the eCourtsIndia API — including all past hearing dates, orders, and status changes since the case was filed, not just current status.
- R4. The fetched CNR number is stored as the permanent identifier for all subsequent monitoring of that case.

**Sync and change detection**

- R5. The sync service runs twice daily for all registered cases using the eCourtsIndia bulk refresh endpoint (supports up to 50 cases per request).
- R6. A lawyer can trigger a manual refresh for a specific case at any time; the result reflects within 10 seconds per eCourtsIndia's stated SLA.
- R7. Each sync compares newly fetched data against the last stored state and writes a new event record for every field that changed.
- R8. Events tracked include: next hearing date set or changed, hearing date passed (case called), case status change, new order or judgement uploaded, judge assignment change, and any other field change returned by the API.

**Data stored per case**

- R9. Case record stores: CNR number, court hierarchy (state, district, court complex, establishment), case type, case number, year, party names, advocate names, presiding judge, and current status.
- R10. Each event record stores: event type, previous value, new value, timestamp the change was detected, and which sync run detected it.

**Notifications**

- R11. The initial setup fetch does not trigger any notification — data is populated silently.
- R12. Subsequent syncs that detect at least one new event mark the case as having unread updates. Notification delivery (in-app, email, push) and configuration are deferred to the notification system brainstorm.

**Court coverage — phased**

- R13. Phase 1: district courts via eCourtsIndia API. Court hierarchy: State → District → Court Complex → Establishment. Case identifier: CNR number.
- R14. Phase 2: High Courts. 24 courts accessed via hcservices.ecourts.gov.in with state code, district code, and court code parameters. Integration approach to be determined in Phase 2 planning.
- R15. Phase 3: Supreme Court. Portal at sci.gov.in. No public API; automated access blocked. Data access strategy unresolved — options include third-party aggregator, official NJDG partnership, or in-house approach.

---

## Key Flows

- F1. **Case registration**
  - **Trigger:** Lawyer creates a new case and links it to a court case.
  - **Actors:** A1, A2
  - **Steps:** Lawyer selects state → district → court complex → establishment → case type → case number → year. Legal Owl calls eCourtsIndia API, receives CNR and full history, stores all events, marks case as synced.
  - **Covers:** R1, R2, R3, R4, R11

- F2. **Scheduled sync**
  - **Trigger:** Sync service fires twice daily.
  - **Actors:** A2, A3
  - **Steps:** Sync service batches all registered cases (≤50 per request), calls eCourtsIndia bulk refresh, compares response to stored state, writes new event records for any changed fields, marks affected cases as having unread updates.
  - **Covers:** R5, R7, R8, R12

- F3. **Manual refresh**
  - **Trigger:** Lawyer taps "Refresh" on a specific case.
  - **Actors:** A1, A2, A3
  - **Steps:** Legal Owl calls eCourtsIndia for that single case, runs change detection, updates stored events. Response reflected within 10 seconds.
  - **Covers:** R6, R7, R8

---

## Acceptance Examples

- AE1. **First fetch includes full history.**
  **Covers R3.** A case filed in 2023 is linked today. The stored event timeline shows all hearing dates, status changes, and orders from 2023 onward, not just today's state.

- AE2. **No notification on setup.**
  **Covers R11.** A lawyer links five cases in one session. No emails, push notifications, or in-app alerts fire. All five cases show their full history in Legal Owl.

- AE3. **Change detected on sync.**
  **Covers R7, R8.** A case had next hearing date 15 July. After a sync, eCourtsIndia returns 22 July. Legal Owl writes a new event: `type: hearing_date_changed, previous: 2026-07-15, new: 2026-07-22, detected_at: <sync timestamp>`.

- AE4. **No change on sync.**
  **Covers R7.** A sync runs and eCourtsIndia returns identical data to the stored state. No new event records are written. The case's last-synced timestamp updates; nothing else changes.

- AE5. **Manual refresh reflects within SLA.**
  **Covers R6.** Lawyer taps Refresh. Within 10 seconds, if any new court data exists, new events appear in the case record.

---

## Scope Boundaries

**Deferred for later**

- Case management dashboard and case page UI — how court events are displayed is a separate brainstorm.
- Notification delivery system (email, push, in-app configuration) — deferred to notification system brainstorm.
- AI-augmented monitoring (auto-ingesting new court orders into the document assistant) — deferred until the AI document assistant track is functional.
- In-house court data fetching layer — eCourtsIndia API for Phase 1; revisit at Phase 2 or 3 when usage volume makes cost meaningful.
- High Court integration — Phase 2.
- Supreme Court integration — Phase 3.

**Outside this product's identity**

- Bulk historical import for cases before Legal Owl existed (beyond what the court portal already provides).
- SMS or WhatsApp notifications.
- Multi-court linking (one Legal Owl case mapped to multiple court case numbers).

---

## Dependencies and Assumptions

- **eCourtsIndia API access.** Commercial use terms must be reviewed and API credentials obtained before implementation begins. Pricing at expected case volume (twice-daily syncs across a growing case portfolio) must be modelled before committing to sync frequency.
- **Full history availability.** Assumes eCourtsIndia returns the complete case history from the filing date, not just current state. To be verified against their API response for an existing multi-year case during integration.
- **eCourtsIndia AI summaries not consumed.** The API returns AI-generated order summaries. Legal Owl does not consume these in Phase 1 to avoid overlap with the AI document assistant track.
- **CNR as stable identifier.** Assumes the CNR number returned on first fetch remains the stable identifier for all future syncs. To be confirmed against eCourtsIndia documentation.

---

## Outstanding Questions

**Resolve before planning**

- Are eCourtsIndia's terms of service compatible with commercial use in a SaaS product? What is the pricing at 500, 5000, and 50,000 cases synced twice daily?
- Does eCourtsIndia's API return the full case history (all past hearings and orders) in a single CNR lookup, or only recent events?

**Deferred to planning**

- Sync job infrastructure — cron job, background worker, or queue-based approach.
- Error handling when eCourtsIndia API is unreachable — retry strategy, stale-data handling, lawyer-facing feedback.
- Data schema — event table structure, indexing strategy for change detection queries.
- Rate limit handling for manual refresh during a scheduled sync window.
