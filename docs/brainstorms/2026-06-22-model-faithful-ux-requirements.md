---
name: Model-faithful, self-describing UX
last_updated: 2026-06-22
status: requirements
scope: deep-feature
---

# Model-faithful, self-describing UX — requirements

## Problem frame

Lawyers don't trust software they can't see into. Legal Owl's data model is rich and well-structured
(Client → Engagement → Matter → Action, plus Hearings, Deadlines, Documents, append-only court_events +
remarks, Inbox triage, workflow_states, labels, action_relations), but the UI surfaces it
**inconsistently and partially** — some attributes and whole capabilities (labels, lifecycle state, task
dependencies) never appear, and each surface invents its own layout. So a user can't confidently answer:
*how is this structured, what are the attributes, what happens, what are the rules?*

**The bet:** make the UI a faithful, self-describing mirror of the data model — the way Linear's UI and
backend "handshake" so the user always knows what's going on. Confidence comes from **every record
teaching in place**: a consistent shape that shows its attributes, current + valid states, relations,
activity, and the rules that govern it.

---

## Actors

- **A1 — Solo lawyer (primary):** the single tenant/user; all data is RLS-scoped to them. No new actors.

---

## Goals & success criteria

- **G1 — Read any record as one legible object.** From a Matter / Client / Action, see its attributes,
  current state, valid next states, relations, and what-happens — without hunting.
- **G2 — Rules are visible and trustworthy.** Computed and invariant rules are shown, not hidden
  (next-hearing is computed; deadlines are by rule; the timeline is append-only; data is per-lawyer).
- **G3 — Help is exhaustively true to the schema.** Every entity, attribute (with its enum domain),
  relation, and rule is documented and kept in sync with the model.
- **G4 — Home teaches lightly.** New/empty states explain Client → Matter → Action and link to Help; the
  daily command center stays clean.
- **Success:** consistency (every entity uses the same "record shell," badge system, and rule
  annotations — no surface invents its own); previously-dormant model parts (labels, lifecycle, task
  dependencies) become visible; qualitatively, the lawyer feels confident they understand the system.

---

## Requirements

- **R1 — A consistent "record shell"** across the core entities (Matter, Client, Action): identity/key +
  status, a **properties** view listing every attribute with its value and domain (enums shown as their
  allowed set), **relations** (linked entities, navigable + counted), **activity/timeline**, and the
  **valid actions** (state transitions) for that record.
- **R2 — State transitions are constrained and legible.** Status/state pickers offer only the valid
  states for that entity's state machine (workflow_states for actions; hearing_state; triage_state;
  matter status + lifecycle), each rendered with the existing shape+color badge.
- **R3 — Rule-driven fields are labelled as rules.** `next_hearing_date` reads as "computed from the
  earliest upcoming scheduled hearing"; deadlines show type/basis ("by rule, never guessed"); the
  court_events + remarks timeline is visibly **append-only**; per-lawyer isolation is stated where
  relevant.
- **R4 — Matter is the flagship self-describing surface.** Its detail presents attributes
  (key/CNR/forum/parties/case_type/status/lifecycle), relations (client/engagement; counts of
  hearings/deadlines/documents/tasks), the merged timeline, and valid actions — so the whole case file
  reads as one legible object. Reduce reliance on hidden tabs where they harm legibility (exact layout is
  a planning call).
- **R5 — Complete the model with cheap dormant features,** surfaced where they belong in the shell:
  - **R5a — Labels/tagging** (`labels` + `action_labels`): create, assign to actions, filter by.
  - **R5b — Lifecycle + sync status** displayed read-only on a matter (`lifecycle_state`,
    `last_successful_sync_at`) so the model is honest about automated vs. manual state — and primes the
    later court-monitoring work.
  - **R5c — Task dependencies** (`action_relations`: blocks / blocked_by / related) shown on the action
    and in its relations.
- **R6 — Deepen the Help glossary to full schema fidelity:** every entity with its attributes (and enum
  domains), relations, lifecycle/state machine, and rules — extending the existing `/help` glossary
  (`apps/web/lib/help/content.ts`), kept in sync with `apps/web/lib/types.ts` + `supabase/migrations/`.
- **R7 — Home educates lightly:** empty/first-run states explain Client → Matter → Action and link into
  Help; a persistent compact entry to Help; the command center is otherwise unchanged.
- **R8 — Consistency is the success metric:** the same record shell, badge system, and rule-annotation
  conventions apply everywhere; no surface invents its own layout.

---

## Key flows

- **F1 — Read a matter as one object:** open a matter → attributes, status + lifecycle, relations,
  timeline, and available actions, with rules annotated.
- **F2 — Change a state:** open a status picker → only valid transitions offered → badge (and timeline
  where applicable) update.
- **F3 — Look up the model:** Help → any entity → its attributes, relations, and rules.
- **F4 — New user / empty section:** a light "how it's structured" explanation that links to Help.
- **F5 — Tag & relate work:** add a label to a task; mark a task blocked-by another → both visible.

---

## Acceptance examples

- **AE1** — On a matter, **every stored attribute is visible somewhere on the page** (no unsurfaced
  columns); id + CNR are copyable; lifecycle + last-sync are shown.
- **AE2** — A task's status picker shows only the workflow states, each as its shape+color badge;
  selecting one updates the badge (and writes a timeline entry where applicable).
- **AE3** — Help → "Matter" lists every attribute with its enum domain (e.g. `forum_type`'s eight
  values), its relations, and its rules (next-hearing computed; timeline append-only).
- **AE4** — A brand-new user (no matters) sees the model orientation + a Help link on Home; once matters
  exist, the orientation recedes.
- **AE5** — A task can be labelled and marked "blocked by" another; both show on the task and in its
  relations.

---

## Scope boundaries

### Deferred for later
- Court-monitoring **automation** (eCourts sync infra: pg_cron + pgmq) — this effort only *displays*
  lifecycle/sync so the model is honest about it.
- Deadline rule-**engine** auto-computation; action **templates**; the **AI-grounding** surface;
  **kanban** board over workflow_states.

### Outside this product's identity (per STRATEGY.md)
- Associate / team task coordination; invoicing; enterprise-firm features.

---

## Dependencies & assumptions

- Builds on existing assets: badge system (`apps/web/components/badges.tsx`), Help glossary
  (`apps/web/lib/help/content.ts`, `apps/web/app/(app)/help/`), shared atoms
  (`apps/web/components/page-header.tsx`), and `EmptyState`.
- **Schema is the source of truth.** Labels, `action_relations`, and `lifecycle_state` already exist in
  the schema (verified live) — surfacing them needs UI + light Server Actions, **no migrations**.
- The Help glossary is **manually** kept in sync with `lib/types.ts` + migrations (assumption — no
  codegen).
- "Self-describing" reduces, but may not eliminate, the matter-detail tabs; the final layout is a
  planning/UX decision.

---

## Outstanding questions (for planning)

- Order of entities to receive the full shell: Matter first (flagship) → then Client, Action — confirm.
- Matter detail: collapse tabs into one legible scroll, or keep tabs but make each self-describing?
- Labels: actions only, or matters too?
- How to present "rule" annotations without clutter — inline hints vs. an info affordance?
