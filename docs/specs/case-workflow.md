---
date: 2026-06-21
topic: case-workflow
superseded_by: task-first re-model (2026-06-24)
---

# Case Workflow — Requirements

> **Superseded (2026-06-24).** This captures the original requirements as decided on 2026-06-21 and
> is kept for history. The data model has since been re-modelled: **Action**, **Hearing**,
> **Deadline**, and **TriageItem** are now one **`tasks`** table (`type: task | hearing | deadline`,
> nullable `state_id`, JSONB `attributes`); the Inbox is tasks in the system `Triage` state.
> **CourtEvent** + **Remark** are now one append-only **`activity`** table (`matters.last_event_at`
> removed). The product behaviour described below still holds; only the table shapes changed. Current
> source of truth: `CLAUDE.md` → "Domain hierarchy" and
> `supabase/migrations/20260624000001_task_first_model.sql`.

## Summary

A Linear-style case-action tracker for solo Indian lawyers. The **Matter** is the container
(Project-equivalent, with an optional CNR so non-eCourts matters fit alongside eCourts cases) and the
**Action** is the ticket (Issue-equivalent) the lawyer moves through a status workflow. eCourts
developments flow into a **Triage inbox** the lawyer accepts into Actions or dismisses to the timeline.
Built on the append-only timeline spine and per-lawyer RLS from `docs/ARCHITECTURE.md`.

## Problem Frame

Solo Indian litigators manage 50–150 active matters across district courts, High Courts, NCLT/NCLAT,
arbitrations, and tribunals — tracked today in Excel plus manual eCourts portal checks. The portal tells
them *what happened*; nothing turns that into *what to do next*. Court developments and the lawyer's own
to-dos live in different places, so work slips between a new order arriving and the lawyer acting on it.
Case Workflow is the system of record that closes that gap: it pulls court developments in and makes them
actionable, while also holding the matters eCourts doesn't cover.

## Key Decisions

- **Matter is the aggregate root, keyed by an internal id; CNR is optional.** A Matter exists with or
  without a CNR, so arbitration, NCLT, and to-be-filed matters are first-class. When a CNR is present, the
  Matter auto-syncs from eCourts. *This revises `docs/ARCHITECTURE.md` §2, which keys the aggregate on a
  NOT-NULL CNR — see Outstanding Questions.*
- **Action is the ticket primitive** (Linear Issue-equivalent); the Matter plays the Project role. Court
  events and lawyer to-dos both become Actions, giving one place to see and prioritize work.
- **Automation lands through Triage, not auto-creation.** Detected court developments enter a Triage inbox;
  the lawyer accepts (→ Action) or dismisses (→ stays on the timeline only). This keeps automation
  reviewable and matches the architecture's approve-before-act stance.
- **Status uses Linear's state-*type* abstraction.** Custom, legal-flavored status names map to a small set
  of types (triage / unstarted / started / blocked / completed / cancelled); the type — not the name —
  drives the board and progress math, so names stay customizable without complicating logic.
- **Hearings and Deadlines are first-class scheduling entities**, not just date fields — they anchor
  prep-Actions ("due before the 22 Jul hearing") and give the deterministic limitation/deadline engine a
  home. Deadline dates are rule-computed, never LLM-generated.
- **Court events carry content-hash natural keys, not provider ids.** eCourts returns no stable
  event/order ids and may reorder/back-fill arrays, so dedup keys on hashed content + a composite natural
  key.
- **Single-user vertical scope.** Drop Linear's Team/Workspace, Cycles, Initiatives, and estimates; keep
  Action relations, sub-actions, labels, and templates where they earn their place.
- **Client is referenced, not built here.** A Matter carries a client link; the client entity, updates,
  and portal belong to the Client Notifs subpart.

## Actors

- A1. **Lawyer** — the single tenant; creates matters and actions, triages court events, moves actions
  through statuses, links hearings/deadlines.
- A2. **eCourts sync service** — the existing court-monitoring spine; detects court developments and writes
  court events that feed Triage. (Consumed here, not built here.)
- A3. **Deadline engine** — deterministic rules (e.g., Limitation Act) that compute Deadline dates and can
  propose anchored Actions.

## Entity Model

Aggregate: **Matter** owns Actions, Hearings, Deadlines, court events, and remarks. The **timeline** is a
derived view (`UNION ALL`) over court events + remarks + action/hearing/deadline changes — not a table.

```
Client ──< Matter (id PK, cnr?, forum_type, lawyer_id)
              ├──< Action (status, priority, due, parent?, relations)
              ├──< Hearing (date, purpose, outcome, source)
              ├──< Deadline (type, due_date computed, basis)
              ├──< CourtEvent (append-only, content_hash key)   ← eCourts sync
              ├──< Remark    (append-only, immutable)           ← lawyer
              └──< TriageItem (← CourtEvent; accept → Action)
Action ── status → WorkflowState (name → type)
Action ──< Action (sub-actions; + blocks/blocked-by/related)
Action ──0..1 Hearing | Deadline (anchored "due before")
```

- **Matter** (≈ Project) — `id` (PK), human key (e.g. `M-123`), `cnr?`, `forum_type`, `title`
  (auto-composed when eCourts, else manual), parties, court hierarchy (when eCourts), `case_type`,
  `court_status` (from eCourts), `matter_status` (lawyer-set), `next_hearing_date` (projection),
  `lifecycle_state`, `client_id?`, `lawyer_id` (RLS), `last_event_at`, `last_successful_sync_at`.
- **Action** (≈ Issue) — `id`, human key (e.g. `ACT-123`), `matter_id`, `title`, `description`, `status`,
  `priority`, `due_date?`, `assignee` (the lawyer), `parent_action_id?`, `source`
  (`manual | triage | template | deadline`), `created_at`.
- **WorkflowState** — `name` + `type` (`triage | unstarted | started | blocked | completed | cancelled`).
  Default names: Triage, To-Do, Awaiting Filing, Filed, Awaiting Hearing, In Progress, Blocked, Done,
  Cancelled.
- **TriageItem** — `id`, `matter_id`, `court_event_id`, `kind`, `summary`, `state`
  (`pending | accepted | dismissed`), `created_at`, `resulting_action_id?`.
- **Hearing** — `id`, `matter_id`, `hearing_date`, `purpose`, `outcome?`, `source` (`ecourt | manual`),
  `state` (`scheduled | held | adjourned`); natural key `(matter_id, hearing_date, ordinal)`.
- **Deadline** — `id`, `matter_id`, `type` (`limitation | statutory | internal`), `due_date` (rule-computed),
  `basis` (e.g. Limitation Act article), `anchor` (hearing/event ref), `computed_at`.
- **CourtEvent** / **Remark** — append-only timeline rows from the spine (see `docs/ARCHITECTURE.md` §2).
- **Label** — categorical tag (practice area, act/section, urgency).
- **Template** — a reusable named set of Actions (e.g. a standard filing sequence).

## Requirements

**Matter (aggregate)**
- R1. A Matter can be created from eCourts (CNR known or discovered via search) or manually for a
  non-eCourts forum; both paths produce the same Matter shape.
- R2. `cnr` is optional and unique when present; a Matter with a CNR auto-syncs from the eCourts spine, one
  without is maintained manually.
- R3. Each Matter has a stable internal id and a human-readable key for reference.
- R4. A Matter tracks two distinct statuses: `court_status` (from eCourts, read-only) and `matter_status`
  (lawyer-set), plus a `lifecycle_state` (`pending_first_sync | active | not_found | disposed`).
- R5. A Matter may link to one Client; the link is the only client coupling in this subpart.

**Action (ticket)**
- R6. The lawyer can create, edit, and delete Actions on a Matter; each Action has a title, optional
  description, status, priority, and optional due date.
- R7. An Action records its `source` (manual, triage, template, or deadline).
- R8. Actions support sub-actions (a parent with children) for decomposing work.
- R9. Actions support relations: blocks, blocked-by, and related.
- R10. Actions can carry labels for filtering.
- R11. An Action can be anchored to a Hearing or Deadline ("due before"), inheriting its date as the
  default due date.

**Workflow / status**
- R12. Statuses are customizable names, each mapped to exactly one type; the type drives board grouping and
  done/active progress.
- R13. The system ships a default legal status set (see Entity Model) that the lawyer can rename or extend.
- R14. Moving an Action between statuses is recorded on the Matter timeline.

**Triage**
- R15. Court developments detected by the sync spine create pending TriageItems, scoped to their Matter.
- R16. The lawyer can accept a TriageItem — creating an Action pre-filled from the event — or dismiss it.
- R17. A dismissed TriageItem remains visible on the Matter timeline as a court event; it does not become
  an Action.
- R18. The first eCourts fetch on Matter creation seeds history silently and does not flood Triage; only
  subsequently detected changes create TriageItems.

**Hearings & Deadlines**
- R19. Hearings are first-class: sourced from eCourts (or entered manually for non-eCourts matters) with
  date, purpose, and outcome.
- R20. `next_hearing_date` on the Matter is a projection always set to the earliest upcoming Hearing.
- R21. Deadlines are first-class and their dates are computed by deterministic rules, never generated by an
  LLM.
- R22. A Deadline records its basis (the rule/article it derives from) and can propose an anchored Action.
- R23. Hearings and Deadlines appear on the Matter timeline and can anchor Actions (R11).

**Timeline & tenancy**
- R24. Each Matter has a unified chronological timeline interleaving court events, remarks, and
  action/hearing/deadline changes.
- R25. Remarks are append-only and immutable; court events are read-only.
- R26. Every entity is scoped to its `lawyer_id` and enforced by RLS; one lawyer can never read another's
  matters.

## Key Flows

- F1. **Create eCourts Matter**
  - **Trigger:** Lawyer registers a case by CNR (or selects one from search).
  - **Steps:** Spine fetches full case detail → Matter created with auto-composed title, court fields,
    Hearings, and seeded court events (no Triage flood) → appears in the Matter list.
  - **Covers:** R1, R2, R3, R4, R18, R19, R20.

- F2. **Create non-eCourts Matter**
  - **Trigger:** Lawyer adds an arbitration / NCLT / to-be-filed matter manually.
  - **Steps:** Lawyer enters forum, parties, status → Matter created with no CNR → Actions, Hearings,
    Deadlines, and Remarks all available; no auto-sync.
  - **Covers:** R1, R2, R5, R6, R19, R21.

- F3. **Court development → Triage → Action**
  - **Trigger:** Sync detects a new order / hearing-date change / status change.
  - **Steps:** A pending TriageItem appears → lawyer accepts (Action pre-filled from the event) or
    dismisses (stays on timeline) → accepted Action enters the workflow.
  - **Covers:** R15, R16, R17, R14, R24.

- F4. **Work an Action through statuses**
  - **Trigger:** Lawyer picks up an Action.
  - **Steps:** Move through statuses (each move timelined), optionally add sub-actions, relations, labels →
    reach a completed/cancelled type.
  - **Covers:** R6, R8, R9, R10, R12, R14.

- F5. **Deadline/hearing-anchored work**
  - **Trigger:** A Hearing is scheduled or a Deadline is computed.
  - **Steps:** Deadline engine computes the date (with basis) → proposes an anchored Action → Action's due
    date defaults to the anchor.
  - **Covers:** R11, R21, R22, R23.

## Acceptance Examples

- AE1. **Optional CNR.** **Covers R1, R2.** A lawyer adds an arbitration matter with no CNR; it gets a
  Matter id, supports Actions/Hearings/Remarks, and never attempts an eCourts sync. Later a district-court
  matter is added by CNR and auto-syncs.
- AE2. **First fetch doesn't flood Triage.** **Covers R18.** Registering a 2023 case seeds its full history
  as court events with zero TriageItems; the next 6 PM sync that finds a changed hearing date creates one
  pending TriageItem.
- AE3. **Accept vs dismiss.** **Covers R16, R17.** A "new order uploaded" TriageItem is accepted → an
  Action "Review order, update client" appears in To-Do. A "judge changed" item is dismissed → it shows on
  the timeline but creates no Action.
- AE4. **Status type drives the board, not the name.** **Covers R12.** The lawyer renames "Awaiting Filing"
  and adds "With Senior Counsel" (both type `started`); both sit in the in-progress board column without
  any logic change.
- AE5. **Deterministic deadline.** **Covers R21, R22.** A limitation deadline is computed from the relevant
  article and shows its basis; the date is identical on every recompute and is never produced by the
  assistant.

## Scope Boundaries

**Deferred for later**
- Action templates beyond a basic reusable set; automation rules that pre-fill Triage suggestions.
- Customizable board views / saved filters; bulk Action operations.
- High Court and Supreme Court coverage (Phase 2/3 of the court-monitoring spine).

**Outside this subpart's identity**
- Client entity, client update delivery, and the client portal → Client Notifs subpart.
- AI/RAG-driven Actions, document chunking, and the trained model → Model / Lawyer Assist subparts.
- The eCourts sync engine internals (scheduling, async refresh, credit accounting) → the existing
  court-monitoring spine; Case Workflow consumes its events.
- Multi-user / firm collaboration, assignments across people, estimates, sprint cycles.

## Dependencies / Assumptions

- Depends on the court-monitoring spine (`docs/specs/court-monitoring.md`)
  for CNR sync and court events, and on the case-management timeline
  (`docs/specs/case-management.md`).
- Assumes the Supabase Postgres + RLS + append-only spine from `docs/ARCHITECTURE.md` (Matter replaces the
  CNR-keyed `cases` aggregate there).
- Assumes a Client entity will exist (owned by Client Notifs); until then `client_id` is a nullable link.
- Assumes the deadline engine's rule set (Limitation Act articles, forum-specific windows) is sourced
  separately; Case Workflow stores and displays computed deadlines.

## Outstanding Questions

**Resolve before planning**
- Reconcile `docs/ARCHITECTURE.md` §2 (CNR NOT-NULL aggregate) with the Matter-id-key decision here —
  update the architecture doc so the data model is consistent.

**Deferred to planning**
- Default status set and which types are board columns vs. collapsed.
- Whether Action human keys are global (`ACT-123`) or per-matter (`M-12/A-3`).
- TriageItem granularity: one per court event vs. grouped per sync run.
- Where the deadline rule set lives and how it is versioned.

## Sources / Research

- eCourts India API analysis (core concepts, entities, async refresh, no stable event ids) — synthesized
  for this brainstorm; concrete endpoints/fields in
  `docs/specs/court-monitoring.md` and
  `prototype/ecourts-streamlit/lib/ecourts_client.py`.
- Linear data-model analysis (Issue/Project/WorkflowState type abstraction, Triage, relations, sub-issues)
  — used as the ticketing reference; overkill entities (Team/Cycle/Initiative/estimate) deliberately
  dropped for a single-user vertical tool.
- `docs/ARCHITECTURE.md` (append-only spine, UNION ALL timeline, RLS, Vercel + Supabase).
