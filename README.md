# Legal Owl

An **AI-native legal office** for solo lawyers and small law firms in India — to manage cases and
clients elegantly, with every AI answer traceable to real case data (not generic LLM output).

- **Product direction:** [`STRATEGY.md`](./STRATEGY.md)
- **Technical architecture (source of truth):** [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- **Stack:** Vercel (Mumbai `bom1`) for the stateless edge · Supabase (Mumbai `ap-south-1`) for the
  data, auth, storage, and durability tier · India data residency under the DPDP Act.

## System overview

Legal Owl is built as **four subparts**:

| # | Subpart | What it is | Key tech |
|---|---------|-----------|----------|
| 1 | **Model** | A data warehouse of legal artefacts, used to train a model that powers lawyer assist. | Supabase Postgres + pgvector (warehouse), training pipeline |
| 2 | **Lawyer Assist** | The LLM harness that assists lawyers with case actions, grounded in real case data. | Vercel AI SDK + AI Gateway, retrieval over the case timeline |
| 3 | **Case Workflow** | A ticket-management-style system for lawyers to manage case actions, integrated with the eCourts India API. | Next.js, Supabase, [eCourts India API](https://ecourtsindia.com/api/docs#core-concepts) |
| 4 | **Client Notifs** | A CRM-like client-success layer that keeps clients updated. | Vercel Chat SDK, Resend email adapter |

The parts compose: **Case Workflow** is the system of record (the case timeline) → **Model** turns the
accumulated legal artefacts into a trained, grounded model → **Lawyer Assist** is the harness lawyers
work through, grounded in that data → **Client Notifs** closes the loop with clients.

### 1. Model
A data warehouse of all legal artefacts (court orders, judgements, case histories, documents) that
becomes the corpus for training a model used by Lawyer Assist. The warehouse is CNR-scoped and
tenant-isolated; the model is built to keep outputs **traceable to real case data**, which is Legal
Owl's core bet. (See the AI layer and grounding/citation-ledger principles in
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).)

### 2. Lawyer Assist
The LLM harness that assists lawyers with case actions — case-grounded chat, hearing-prep summaries,
draft generation, and event-triggered client updates. Built on a **host-agnostic model layer**
(OpenRouter today, with pluggable adapters for other hosts), with
**citation-ledger provenance** (every assertion links to a source span), **abstention by default**
("not in the case file"), and **deterministic** handling of legal-consequential math (limitation /
hearing dates computed by rules, never generated). Outbound actions default to *approve-before-act*.

### 3. Case Workflow
A ticket-management-like system for lawyers to manage case actions, integrated with the
[eCourts India API](https://ecourtsindia.com/api/docs#core-concepts). It tracks cases by CNR, syncs
court events on a schedule, and maintains the unified case timeline (court events + lawyer remarks)
that everything else grounds on. This is the system of record — the foundation the other subparts
depend on.

### 4. Client Notifs
A CRM-like client-success layer that turns court events into plain-language, lawyer-approved client
updates. Built on the **Vercel Chat SDK** (multi-channel messaging) with a **Resend** email adapter
for delivery. Clients stay informed without manual email threads; lawyer work-product (remarks) is
never exposed to clients.

## Repository layout

```
STRATEGY.md                  # product strategy (source of truth for direction)
README.md                    # this file
docs/
  ARCHITECTURE.md            # finalized technical architecture (source of truth)
  specs/                     # durable requirements (court-monitoring, case-management, case-workflow, app-surface)
  design/                    # frontend design learnings
  research/                  # architecture + Vercel/Supabase + AI-native research
  plans/                     # implementation plans
apps/
  web/                       # Next.js app (Vercel) — the product
supabase/
  migrations/                # database schema (Supabase, Mumbai)
```

## Running the web app

The product lives in [`apps/web`](./apps/web) (Next.js App Router). From that directory:

```bash
npm install
npm run dev        # local dev (Turbopack)
npm run build      # production build — typecheck + routes (the green-build gate)
npm run lint       # ESLint
```

Environment: copy the Supabase + Resend keys into `apps/web/.env.local` (and root `.env` for the
DB password); these are gitignored. Database schema is in [`supabase/migrations/`](./supabase/migrations)
— apply with `supabase db push --db-url "$DBURL"` (Mumbai session pooler).

## Status

The production app (Next.js + Supabase, deployed on Vercel) is built foundation-first. **Shipped:**

- **App shell** — responsive sidebar + header, ⌘K command palette, global "New" menu, off-dark theme.
- **Case management (the foundation)** — **Client → Matter → Task** (task-first, Linear-inspired).
  Client intake with an advisory conflict check; the **Matter** case file (pinned header, editable
  details, parties, one unified **activity** timeline of court events + remarks, Tasks, Hearings +
  outcomes, Deadlines, Documents). Hearings and deadlines are just typed tasks with a date.
- **Workflow** — cross-matter **Tasks** (filters, inline edit) and an **Inbox** (court-update triage:
  accept-as-task with priority/due, snooze-to-day-before-hearing, dismiss).
- **Court monitoring** — **live eCourts sync** (connect a matter by CNR, "Sync now", a nightly cron)
  that diffs the portal and lands new court events on the timeline and as Inbox items.
- **Calendar** — agenda of upcoming hearings + deadlines across all matters.
- **Documents** — per-matter upload to a private Supabase Storage bucket (signed-URL download).
- **Auth** — passwordless magic-link + 6-digit code (via Resend), behind a waitlist `has_access`
  gate. RLS per `lawyer_id` throughout.
- **Onboarding** — a "See it in action" toggle that seeds realistic demo data and launches a minimal
  **spotlight product tour** (replayable from Help).
- **Owl assistant rail** — a persistent, context-aware right sidebar. Scoped to the open matter (and
  isolated to that case file), it answers questions **only from the record, with sources** (and
  abstains otherwise), and surfaces agent proposals for approval.
- **Agent grounding layer (live)** — a span-cited **facts** store + **citation ledger**, schema-locked
  approve-before-act agents (`apps/web/lib/agents/`), and a define-once **typed-action** primitive
  (`apps/web/lib/actions/`). An interactive eCourts sync now reaches agents: **Court Scout** turns a
  court change into a cited proposal, and the demo shows Court Scout, **Intake Registrar** (order →
  span-cited fact), and **Limitation Clerk** (order date → deadline) proposals — each approvable into a
  real record.

**Design + audits:** the agent architecture
([`docs/design/agent-architecture.md`](./docs/design/agent-architecture.md)), the agent-army
requirements
([`docs/brainstorms/2026-07-05-agent-army-grounding-layer-requirements.md`](./docs/brainstorms/2026-07-05-agent-army-grounding-layer-requirements.md)),
and the **eCourts integration audit + leverage plan**
([`docs/research/2026-07-06-ecourts-integration-audit.md`](./docs/research/2026-07-06-ecourts-integration-audit.md))
— how to use the eCourts API so agents drive ~100% of a solo litigator's desk work.

**Not yet built:** the deterministic limitation **rule engine** (dates are still rule-stubbed), order
**PDF ingestion / OCR** into the facts store (audit P2), the cause-list **morning board** (P1) and
**search-driven intake** (P3), the **Act/Check** sub-task UI, and the client-facing **Client Notifs**
portal.

See [`CLAUDE.md`](./CLAUDE.md) for build commands, conventions, and architecture notes for the app.
