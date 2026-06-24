---
date: 2026-06-21
topic: app-surface-and-lifecycles
superseded_by: task-first re-model (2026-06-24)
---

# App Surface & Lifecycles — Requirements

> **Superseded (2026-06-24).** Kept for history. The **Engagement** layer described here was
> **dropped**: the hierarchy is now **Client → Matter → Task** (a Matter links its Client directly;
> there is no `engagement_id`). Hearings, deadlines, and triage items are typed **`tasks`** rows, not
> separate entities. The app-shell, onboarding, and conflict-check behaviour below still hold.
> Current source of truth: `CLAUDE.md` → "Domain hierarchy" and
> `supabase/migrations/20260624000001_task_first_model.sql`.

## Summary

Defines the full Legal Owl application surface beyond the Case Workflow core: the
**Client → Engagement → Matter → Action** hierarchy, the app shell (sidebar/bottom-nav, a Today
dashboard, settings & profile), and the client and matter onboarding lifecycles — with a built-in
conflict check. Scoped to a v1 (lifecycle + shell) on top of what exists, with finance, documents,
calendar, and accounting designed as sequenced later modules.

## Problem Frame

What's built today is the spine and the gate — auth + waitlist, a Matter list, the Case Workflow data
model — but a solo lawyer can't run a practice on a matter list alone. There is no Client entity (a
client is only a nullable `client_id` link on a matter), no place to see "what needs me today," no
account/profile management, and no onboarding path from "a new client walked in" to "their case is
being tracked." This brainstorm maps the screens, entities, and lifecycles that make Legal Owl a
real-world application, and draws the v1 line so the rest can land as modules over time.

## Key Decisions

- **Four-level domain hierarchy: Client → Engagement → Matter → Action.** A client has one or more
  engagements (retainers / one-off briefs); an engagement groups matters; matters carry actions. This
  replaces the bare `client_id` link on Matter — a Matter now belongs to an Engagement, and its client
  is reached through the engagement. *(Revises `docs/specs/case-workflow.md`.)*
- **Engagement is thin in v1.** It is a named grouping with a scope note and a status. Fee/retainer
  amounts, billing, and payments belong to the later finance module — the engagement is where they will
  attach.
- **Matter creation stays one step.** Because every matter needs an engagement, each client gets an
  auto-created default "General" engagement; the lawyer only names an explicit engagement when they want
  a retainer grouping. Onboarding a matter never forces an engagement decision.
- **Lightweight client record + automated conflict check.** Clients capture identity, contacts, and a
  status; v1 adds a conflict check that flags when a new client or opposing party already appears as a
  party in existing matters. Engagement letters and KYC capture are deferred to later modules.
- **Modules ship gradually.** v1 = shell + lifecycle (clients, engagements, matters, conflict check,
  dashboard, settings/profile) over the existing Case Workflow. Finance → Documents → Calendar →
  Accounting (and the Client Notifs portal) are later modules; the IA reserves room for them now.
- **Stays within STRATEGY.md's exclusions in v1.** No invoicing/accounting, no enterprise/multi-user, no
  full document-management suite in the first build.

## Actors

- A1. **Lawyer** — the single tenant; onboards clients, creates engagements and matters, manages their
  profile and account.
- A2. **Client** — a subject/record, not a user in v1 (no client login until the Client Notifs portal).
- A3. **eCourts sync service** — feeds matters with court data (existing spine).

## Entity Model

`Client (1) ──< Engagement (1) ──< Matter (1) ──< Action`, with Matter also owning Hearings, Deadlines,
TriageItems, court events, and remarks (from the Case Workflow spec).

- **Client** — `type` (individual | organisation), display name, contacts (phones, emails, address;
  org may carry GSTIN/PAN as plain fields), `status` (lead | active | inactive), notes, `lawyer_id` (RLS).
- **Contact** — a person attached to a client (name, role, phone, email) — for orgs with multiple points
  of contact. (May be a thin sub-record of Client in v1.)
- **Engagement** — `client_id`, name, scope note, `status` (open | on_hold | closed); a default
  "General" engagement is auto-created per client. (Fee/retainer fields = finance module.)
- **Matter** — now `engagement_id` (→ client) instead of a bare `client_id`; otherwise as specified in
  the Case Workflow spec (optional CNR, lifecycle state, etc.).
- **Conflict flag** — a detected potential conflict (the matched name, where it appears, the
  client/matter under review); surfaced for the lawyer to acknowledge or dismiss, not auto-blocking.

## Information Architecture

Global shell (desktop sidebar / mobile bottom-nav) + command palette, per
`docs/design/frontend-design-learnings.md`.

- **Today** — the dashboard/home (hearings, deadlines, triage count, due/blocked actions).
- **Triage** — court-event inbox (badge).
- **Clients** — client list → client detail (contacts, engagements, matters, conflict flags).
- **Matters** — matter list → matter detail + timeline (existing); reachable from a client/engagement too.
- **Actions** — cross-matter action list.
- **Settings** — Profile, Account, eCourts connection, Notifications, (Appearance later).

Auth/landing/waitlist already exist outside the shell.

## Lifecycles

- **Client:** `lead` → `active` → `inactive`. Conflict check runs at intake (lead/active creation).
- **Engagement:** `open` → `on_hold` → `closed`.
- **Matter:** `pending_first_sync` → `active` → `disposed` → `closed/archived` (extends the Case
  Workflow lifecycle with a closed/archived end state).

## Requirements

**App shell & navigation**
- R1. A persistent shell provides navigation to Today, Triage, Clients, Matters, Actions, and Settings —
  a sidebar on desktop, a bottom-nav on mobile.
- R2. A command palette allows jumping to any client, matter (by name or CNR), or action, and
  quick-creating a client/matter/action.
- R3. Triage and the daily core loop are reachable in one tap without using the command palette.

**Dashboard (Today)**
- R4. Today shows, in urgency order: today's hearings, items due today/this week, the triage count, and
  blocked actions; empty sections are hidden.
- R5. Today shows a last-synced indicator so the lawyer knows whether the data is current.

**Clients**
- R6. The lawyer can create a client as an individual or an organisation, with one or more contacts.
- R7. A client has a status (lead → active → inactive) and notes.
- R8. The client list shows each client with their active-matter count and next hearing across their
  matters; a client detail shows contacts, engagements, and matters.
- R9. Creating a client auto-creates a default "General" engagement so matters can be added immediately.

**Conflict check**
- R10. When creating a client, or adding a matter with opposing parties, the system checks the names
  against parties in existing matters and surfaces any potential conflicts.
- R11. A conflict flag is advisory — the lawyer acknowledges or dismisses it; it never blocks creation,
  and the decision is recorded.

**Engagements**
- R12. The lawyer can create named engagements under a client with a scope note and status.
- R13. An engagement groups one or more matters; matters created without an explicit engagement fall
  under the client's default engagement.
- R14. Closing an engagement does not close its matters automatically; matters are closed individually.

**Matter onboarding**
- R15. Creating a matter requires a client; the engagement defaults to the client's General engagement
  unless the lawyer picks/creates another.
- R16. Matter creation supports both an eCourts path (CNR known/searched → auto-sync) and a manual path
  (non-eCourts forums), per the Case Workflow spec.
- R17. A newly created matter appears under its client and engagement and in the global matter list.

**Settings & profile**
- R18. The lawyer can edit their profile: display name, firm name, bar council ID, primary court /
  practice areas.
- R19. The lawyer can manage their account: change password, sign out, and request account deletion.
- R20. Settings shows the eCourts connection status (and, when per-lawyer credentials exist, lets the
  lawyer manage them).
- R21. The lawyer can set in-app notification preferences (what surfaces in Today / triage); external
  delivery is the Client Notifs module.

**Lifecycle states**
- R22. Client, Engagement, and Matter each expose their lifecycle status and can be moved through it.
- R23. Closing/archiving a matter removes it from default active lists while keeping it readable.
- R24. An inactive client and its closed engagements/matters remain searchable and viewable.

## Key Flows

- F1. **Onboard a client (with conflict check)**
  - **Trigger:** A new client engages the lawyer.
  - **Steps:** Lawyer creates the client (type, contacts) → system runs the conflict check against
    existing matter parties → lawyer acknowledges/dismisses any flag → client saved as a lead/active with
    a default General engagement.
  - **Covers:** R6, R7, R9, R10, R11.

- F2. **Onboard an engagement + matter**
  - **Trigger:** Lawyer takes on a case for an existing (or new) client.
  - **Steps:** From the client, optionally create a named engagement (retainer) → create the matter
    (eCourts CNR or manual), defaulting to the General engagement if none chosen → matter syncs/seeds and
    appears under client/engagement and in the matter list.
  - **Covers:** R12, R13, R15, R16, R17.

- F3. **Daily core loop**
  - **Trigger:** Lawyer opens the app.
  - **Steps:** Today shows hearings/deadlines/triage → lawyer clears triage (accept → action) → works
    actions → adds remarks. All in-shell, mobile-first.
  - **Covers:** R1, R3, R4, R5.

- F4. **Close-out**
  - **Trigger:** A matter is disposed / an engagement ends / a client goes dormant.
  - **Steps:** Lawyer marks the matter closed/archived (still readable) → optionally closes the
    engagement → optionally marks the client inactive. Nothing cascades automatically.
  - **Covers:** R14, R22, R23, R24.

## Acceptance Examples

- AE1. **Conflict surfaced.** **Covers R10, R11.** Adding client "Acme Corp" flags that "Acme Corp"
  already appears as the respondent in an existing matter; the lawyer sees the match and where it occurs,
  dismisses it as unrelated, and proceeds — the dismissal is recorded.
- AE2. **One-step matter under default engagement.** **Covers R9, R13, R15.** A lawyer creates a client
  and immediately adds a matter without thinking about engagements; the matter lands under the client's
  auto-created General engagement.
- AE3. **Retainer grouping.** **Covers R12, R13.** A corporate client gets an "FY26 Retainer" engagement
  with three matters and a separate "One-off NCLT" engagement with one — both visible under the client.
- AE4. **Close without cascade.** **Covers R14, R23.** Closing the "FY26 Retainer" engagement leaves its
  three matters active; the lawyer closes one matter, which drops off active lists but stays searchable.

## Module Roadmap

- **v1 (now):** app shell + Today dashboard + Clients (+ conflict check) + Engagements (thin) + Matters
  / Case Workflow + Triage + Actions + Settings/Profile.
- **Finance** (next): fees/retainers on engagements, payments received, outstanding, expense logging —
  not invoicing/GST/accounting.
- **Documents:** per-matter document storage, KYC capture, engagement letters — ties into Lawyer Assist /
  Model.
- **Calendar:** hearings/deadlines calendar view and external sync.
- **Client Notifs:** the client portal + automated, lawyer-approved client updates (existing subpart).
- **Lawyer Assist / Model AI surfaces** layer across all of the above as they mature.

## Scope Boundaries

**Deferred for later (sequenced modules)**
- Finance, document management, calendar, client portal/notifications, engagement-letter generation, KYC
  document capture — see Module Roadmap.
- Per-lawyer eCourts credentials/credit accounting (v1 uses the platform connection).

**Outside this product's identity (per STRATEGY.md)**
- Invoicing / GST / full accounting; enterprise / multi-user / firm collaboration; a general
  document-management suite competing with practice-management incumbents.

## Dependencies / Assumptions

- Builds on the Case Workflow spec (`docs/specs/case-workflow.md`) and the
  design learnings (`docs/design/frontend-design-learnings.md`); shares the Vercel + Supabase
  + RLS architecture (`docs/ARCHITECTURE.md`).
- Conflict check relies on party names already stored on matters (the Case Workflow `parties` data).
- Assumes the single-lawyer tenant model; clients are records, not users, until the Client Notifs portal.

## Outstanding Questions

**Resolve before planning**
- Reconcile the Case Workflow schema: a Matter now references an Engagement (→ Client) rather than a bare
  `client_id` — confirm whether to keep a denormalised client reference on Matter for query convenience.

**Deferred to planning**
- Whether Contact is a separate entity or embedded in Client for v1.
- Conflict-check matching strength (exact vs fuzzy name match) and how matches are presented.
- Whether engagement appears as its own nav section or only within the client detail.
- Settings depth for the eCourts connection while the platform uses a single shared key.
