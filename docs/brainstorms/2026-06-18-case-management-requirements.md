---
date: 2026-06-18
topic: case-management
---

# Case Management — Requirements

## Summary

A case management layer built on top of the court monitoring data layer. Registering a case through court monitoring automatically creates a case record pre-filled with eCourts data. Each case has an auto-composed title, eCourts-sourced fields, and a unified chronological timeline interleaving court events with the lawyer's Remarks. Phase 1 covers district court cases only, linked through court monitoring registration.

---

## Problem Frame

Solo lawyers currently track their cases in an Excel sheet with columns for case number, forum, petitioner, respondent, background, next hearing date, remarks, and status. The remarks column is updated over time but there is no history — each update overwrites the last. Nothing is connected to court data, so every field requires manual maintenance.

The case management track replaces this with a structured, automatically-updated record per case. The reference document analysed is a real lawyer's case tracker (MBECL Matters Update, June 2026) covering 25+ active matters across Commercial Courts, High Courts, NCLT, NCLAT, arbitrations, and tribunals — confirming that the forum diversity is wide, and that many cases have no court case number at all.

---

## Key Decisions

- **Registration creates the case record.** The court monitoring registration flow (selecting court hierarchy + case type + number + year) is the single entry point for Phase 1 cases. It creates both the court monitoring subscription and the case management record in one action. There is no separate "create case" step.

- **Auto-composed title, not AI-generated background.** The eCourtsIndia API's `caseAiAnalysis` field is null in practice. The per-order AI endpoint (10–60 seconds, billed per order) is not the right source for a case-level summary. Phase 1 uses a title auto-composed from eCourts fields: `{Petitioner} vs {Respondent} · {Forum}`. If `caseAiAnalysis` returns non-null on a given case, it is surfaced as a bonus context field — not a reliable primary field.

- **Unified timeline, not separated panels.** The case page shows a single chronological timeline interleaving court monitoring events (hearing date changes, status changes, orders uploaded) with the lawyer's Remarks entries. Background context is pinned at the top. This model makes Remarks history meaningful — the lawyer can see what they noted alongside what the court was doing at the same time.

- **Remarks are append-only.** Each time a lawyer saves a new Remark, it is stored as a new timestamped entry. Past entries cannot be edited or deleted. This preserves the full history of the lawyer's observations over the life of the case.

- **Court status only in Phase 1.** Legal Owl displays the status returned by eCourts (Pending, Disposed, etc.). A separate internal business status (e.g. "To Be Filed") is not supported in Phase 1 — deferred to future scope.

---

## Actors

- A1. **Lawyer** — registers cases, writes Remarks, views the case timeline.
- A2. **eCourtsIndia API** — source of all case data: parties, court hierarchy, status, next hearing date, event history.
- A3. **Court monitoring sync service** — writes court events to the shared timeline on each sync run.

---

## Requirements

**Case record creation**

- R1. Completing the court monitoring registration flow (court hierarchy + case type + number + year) automatically creates a case management record for that case — no separate creation step.
- R2. The case record is pre-filled with all fields returned by the eCourtsIndia case detail response: CNR, court hierarchy, case type, case number, filing year, petitioner name(s), respondent name(s), presiding judge, current status, and next hearing date.
- R3. The case title is auto-composed as `{Petitioner} vs {Respondent} · {Forum}` using eCourts data — no manual input required.
- R4. If the `caseAiAnalysis` field in the eCourtsIndia response is non-null, it is stored and surfaced on the case record as a context field labelled "AI summary (court data)." If null, the field is not shown.

**Case timeline**

- R5. The case page shows a unified chronological timeline, oldest events at the top and newest at the bottom.
- R6. Court events from the monitoring sync service appear on the timeline: hearing date changes, case status changes, orders uploaded, judge changes, and any other field change detected by the sync.
- R7. Lawyer Remarks entries appear on the same timeline, visually distinct from court events.
- R8. The case title and eCourts fields (status, next hearing date, parties, court hierarchy) are pinned above the timeline and always visible without scrolling.

**Remarks**

- R9. A lawyer can add a new Remark to any case at any time by typing free-form text and saving.
- R10. Each saved Remark is stored as a new immutable entry with: the Remark text, the timestamp it was saved, and the identity of the lawyer who saved it.
- R11. Past Remarks cannot be edited or deleted. The full Remarks history is always visible on the timeline.

**Case list**

- R12. The lawyer sees a case list showing all their registered cases, ordered by next hearing date ascending (most urgent first). Cases with no next hearing date appear at the bottom.
- R13. Each case in the list shows: case title, forum, current status, and next hearing date.

**Court events on the timeline**

- R14. Court events written by the sync service to the timeline include: event type, what changed (previous value → new value), and the timestamp the change was detected.
- R15. Court events are read-only on the case page — lawyers cannot edit or delete them.

---

## Key Flows

- F1. **Case registration and record creation**
  - **Trigger:** Lawyer completes the court monitoring registration (court hierarchy + case details).
  - **Actors:** A1, A2
  - **Steps:** Registration fetch returns full case detail from eCourtsIndia. Case management record is created with auto-composed title and all eCourts fields. `caseAiAnalysis` surfaced if non-null. Historical court events from the full case history are written to the timeline. Case appears in the case list.
  - **Covers:** R1, R2, R3, R4, R6, R12

- F2. **Adding a Remark**
  - **Trigger:** Lawyer types a new Remark and saves.
  - **Actors:** A1
  - **Steps:** Remark is stored as a new timestamped entry and immediately appears on the case timeline below the most recent entry.
  - **Covers:** R9, R10, R11

- F3. **Court event lands on timeline**
  - **Trigger:** Sync service detects a change during the daily sync or manual refresh.
  - **Actors:** A2, A3
  - **Steps:** Sync service writes a court event record. The event appears on the case timeline at the correct chronological position. If next hearing date changed, the pinned field updates.
  - **Covers:** R6, R7, R14, R15

---

## Acceptance Examples

- AE1. **Case record created on registration.**
  **Covers R1, R2, R3.** Lawyer registers a district court case. Immediately after, a case record exists with title "MBECL vs SCCL · Commercial Court Hyderabad", CNR number, parties, next hearing date, and status — without the lawyer entering any of this manually.

- AE2. **Remarks history preserved.**
  **Covers R10, R11.** Lawyer adds a Remark "Arguments completed" on 18 June. Two weeks later adds "Rejoinder filed." Both appear on the timeline with their respective timestamps. The June 18 entry cannot be modified.

- AE3. **Court event and Remark on same timeline.**
  **Covers R6, R7.** Sync detects hearing date changed from 15 July to 22 July. This appears on the timeline as a court event. Below it, the lawyer adds a Remark "Client informed of new date." Both are visible chronologically on the same view.

- AE4. **No caseAiAnalysis — no bonus field shown.**
  **Covers R4.** eCourtsIndia returns `caseAiAnalysis: null` for a case. The case record shows no AI summary field. No empty placeholder is displayed.

- AE5. **Case list sorted by urgency.**
  **Covers R12, R13.** Lawyer has 10 cases. The case with next hearing date 19 June appears first. Two cases with no next hearing date appear at the bottom.

---

## Scope Boundaries

**Deferred for later**

- Manual case creation without an eCourts link — for arbitrations, tribunals, and tax matters not on eCourts. Named as a high-value future feature based on the real lawyer data observed.
- Client name and client record — no client entity in Phase 1.
- Internal business status (e.g. "To Be Filed", "Reserved for Order") — court status only in Phase 1.
- AI-generated case background/summary from lawyer documents — deferred to AI document assistant track.
- Document attachments per case — not in scope for Phase 1.
- Related case linking — some disputes have multiple parallel cases (e.g. S.34 and S.36 filed simultaneously); linking them is deferred.
- Financial amounts as structured fields — currently captured in the eCourts data narrative; structured amount fields deferred.

**Outside this product's identity**

- Editing or deleting past Remarks — Legal Owl preserves the full unmodified history.
- Editing court events — these are read-only records of what the court reported.

---

## Dependencies and Assumptions

- **Court monitoring data layer.** Case management is built on top of the court monitoring requirements (`docs/brainstorms/2026-06-17-court-monitoring-data-layer-requirements.md`). All data flows from that layer. Case management does not make independent eCourtsIndia API calls — it consumes events and fields already fetched by court monitoring.
- **`caseAiAnalysis` field availability.** The field exists in the eCourtsIndia case detail response and is null in the documented example. When non-null it contains structured sub-fields: summary, key points, outcome, relief granted, and legal provisions cited (under `intelligent_insights_analytics`). Treated as a bonus — never a required field.
- **Party names as plain string arrays.** eCourtsIndia returns `petitioners` and `respondents` as plain string arrays (e.g. `["MR.ARUN JAITLEY"]`). The auto-composed title uses the first element of each array; multiple parties are joined with a comma.
- **Single lawyer per case in Phase 1.** No multi-user access, shared cases, or role-based visibility within a firm. Deferred.
- **Forum diversity acknowledged but deferred.** The reference Excel sheet included NCLT, NCLAT, arbitrations, MSME councils, and state tribunals — none covered by eCourts. Phase 1 is district courts only.

---

## Outstanding Questions

**Deferred to planning**

- Data model for the unified timeline — how court events (from court monitoring) and Remarks (from case management) are stored and queried together in chronological order.
- Pagination or infinite scroll for the timeline on cases with long histories.
- Whether the case list supports filtering or search in Phase 1.
