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
draft generation, and event-triggered client updates. Built on the Vercel AI SDK + AI Gateway, with
**citation-ledger provenance** (every assertion links to a source span), **abstention by default**
("not in the case file"), and **deterministic** handling of legal-consequential math (limitation /
hearing dates computed by rules, never generated). Outbound actions default to *approve-before-act*.

### 3. Case Workflow
A ticket-management-like system for lawyers to manage case actions, integrated with the
[eCourts India API](https://ecourtsindia.com/api/docs#core-concepts). It tracks cases by CNR, syncs
court events on a schedule, and maintains the unified case timeline (court events + lawyer remarks)
that everything else grounds on. This is the system of record — the foundation the other subparts
depend on.

> A Streamlit prototype of the eCourts integration + case data model lives at
> [`prototype/ecourts-streamlit/`](./prototype/ecourts-streamlit/) (reference for the production
> Next.js build).

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
  brainstorms/               # requirements: court monitoring, case management
  research/                  # architecture + Vercel/Supabase + AI-native research
prototype/
  ecourts-streamlit/         # Streamlit prototype of the eCourts integration
```

## Status

Pre-production. The architecture is finalized (`docs/ARCHITECTURE.md`); the production app
(Next.js + Supabase) is being built foundation-first: Case Workflow (system of record) →
Model + Lawyer Assist → Client Notifs.
