---
date: 2026-06-19
topic: vercel-native-feasibility
status: research — not yet decided
method: 9-lane Vercel-product research workflow + synthesis + extreme adversarial critique
related: 2026-06-19-architecture-ideas-from-legal-systems.md
---

# Legal Owl on Vercel — 100% Native Feasibility

Extreme analysis of what it would take to build Legal Owl as a 100% Vercel-native application.
Produced by fanning out 9 research lanes across the Vercel product surface (compute, jobs/workflows,
data/storage, **data residency/DPDPA**, auth, AI, security, frontend/DX, cost/lock-in) — each grounded
against current Vercel docs — then synthesizing a component→product mapping + reference architecture,
then running an *extreme* adversarial stress-test of the 100%-native claim.

> **How to read this doc:** Section 0 is the reconciled, decision-ready conclusion — start there.
> Sections 1–6 are the full researched proposal. Section 7 is the extreme critique that corrected it.
> Where they conflict, **the critique wins** — the synthesis was too charitable to the native ceiling.

---

## 0. Decision-ready conclusion (start here)

### Verdict
**100% Vercel-native is not "75–80% achievable with a small residue" — it is structurally impossible for
this product, and chasing it would put litigant PII outside India and the core daily job on beta infra.**
The genuinely-native ceiling, *without compromising DPDPA or sync reliability*, is **~55–65%**.

Three structural blockers (none configurable away):
1. **US control plane** — `bom1` pins data-plane compute + Blob bytes, **not** the control plane.
   Deployment metadata, env-var names, build logs, WAF/Firewall analytics are processed in the US.
   An irreducible US sub-processor you cannot pin.
2. **No India identity option exists** — no Marketplace auth provider (Clerk = US, Auth0 = no India)
   hosts identity PII in India. The IdP holds the lawyer↔client relationship graph — the most sensitive
   relational data in the system — and there is no connection-string swap for it.
3. **No durable-state residency** — Vercel Workflow DevKit (WDK) / Queues managed persistence has **no
   user-selectable region**, so case PII in step payloads may leave India. WDK is also **beta**.

**The honest one-liner:** *Vercel for the stateless `bom1` edge (compute + delivery); Supabase-Mumbai for
the entire data-and-durability tier (spine + queue + auth + vector store). Nothing that holds litigant PII
or coordinates billable external calls lives in a Vercel-managed durable store.*

### The dividing line
- **Vercel owns:** stateless, in-region (`bom1`) compute + delivery — frontend, app/API, manual-refresh
  function, Blob (PDF bytes), Runtime Cache/Edge Config, Firewall/WAF, Sensitive Env Vars, and **Cron as a
  trigger only**.
- **Supabase-Mumbai (`ap-south-1`) owns:** everything that holds bytes overnight or holds identity —
  Postgres spine, durable worker, auth, vector store.

### The 5 decisions to lock in
1. **Spine = Supabase Postgres `ap-south-1` (Mumbai).** Non-negotiable; resolves the primary residency
   blocker; pure Postgres so it's also the *lowest* lock-in choice (`pg_dump`-portable). **Neon is dead on
   arrival — no India region** (its closest is Singapore, which DPDP forbids for this data).
2. **Durable sync = Graphile Worker inside Supabase Mumbai, triggered by Vercel Cron.** Choose it for
   **transactional enqueue + residency + maturity** — not just residency. Do **not** start on WDK/Queues
   (beta + no residency control). This *reverses* the synthesis's "Graphile Worker is obsolete" framing:
   for this product it is the correct, residency-safe, low-lock-in option. Guard idempotency around the
   **billable eCourts call**, not just the DB write, to stop credit-burn amplification on retry.
3. **Identity = Supabase Auth in Mumbai, not Clerk.** Avoids the double auth-migration trap (the most
   painful migration in software, done twice) and keeps identity PII in-region. RLS keys on the Supabase
   JWT `sub`; enforce RLS context with `SET LOCAL` inside an explicit transaction only (never plain `SET`
   on a pooled connection — a leaked RLS context = one lawyer seeing another's cases).
4. **Compliance-by-default for logs from day one.** Configure a Log Drain to an India-hosted sink *before*
   the first PII endpoint ships (function logs will contain CNRs, party names, PII in stack traces — the
   default native logging path is a day-one DPDP violation). Formally record the irreducible US
   control-plane sub-processor (or escalate to Enterprise for contractual cover).
5. **Defer AI + client portal as schema-only foundations** (CNR scoping, `Document.source` ENUM,
   RLS-ready client↔case join table). Zero runtime dependency on AI Gateway / auth until India residency
   exists. **Reversible (schema) foundations only — never runtime bets on beta products.**

### Cost is NOT the deciding factor
All-native ≈ **$30–40/mo**, hybrid (Vercel Pro + Supabase Pro Mumbai) ≈ **$47–54/mo** — a ~$10–15/mo
delta, immaterial. The real cost axis is **eCourtsIndia credit spend** (daily sync × 150 cases ×
per-credit billing, amplified by any retry/double-fire bug). The deciding factor is **legal defensibility
under DPDP**, which the all-native stack cannot deliver.

### When the calculus changes
If/when **Neon (or a Vercel-first Postgres) adds `ap-south-1`** *and* Vercel ships India residency for
WDK/Queues, AI Gateway, and an auth provider, consolidating toward fully-native becomes viable. The hybrid
is deliberately built so that migration is a connection-string change, not a re-architecture.

---

## 1. Synthesis verdict (original)
A 100% native build was assessed as **not advisable; ~75–80% native achievable**, with the **Postgres spine
+ DPDP residency** as the single biggest blocker. *(The critique revises this down to ~55–65% — see §0/§7.)*

## 2. Component → Vercel product mapping

| Legal Owl component | Vercel product | Fit | Required config |
|---|---|---|---|
| Frontend (dashboard, timeline, case detail) | Next.js 16 App Router (RSC, Server Actions, shadcn/ui) | **native** | `regions:['bom1']`; timeline reads the `UNION ALL` view in a Server Component |
| App / API layer | Vercel Functions (Node) + Fluid Compute | **native** | `fluid:true`; Node runtime (not Edge — 25s cap); `attachDatabasePool()` to release pool clients before suspension |
| Postgres spine (views, triggers, ENUMs, JSONB, RLS, composite idx) | Marketplace Postgres — **Supabase `ap-south-1`** (not Neon/Prisma — no India region) | **partial** | Provision in Mumbai at creation (region immutable); pooled conn; RLS via non-superuser role + per-request JWT claim |
| Daily 6PM IST sync | Vercel Cron → WDK/Queues fan-out | **partial** | Cron `'30 12 * * *'` (UTC; IST has no DST); `CRON_SECRET`; idempotent reconciliation (cron is best-effort) |
| Per-case durable queue / missed-run recovery | WDK *(synthesis)* → **Graphile Worker in Supabase** *(critique)* | **partial** | per-(case, run-date) idempotency key; **WDK persistence region not selectable** |
| Manual refresh (POST → poll 1s up to 15s) | Single Vercel Function (Fluid), `maxDuration ~20–30s` | **native** | 300s Fluid ceiling covers 15s; `useOptimistic`; client-side timeout returns DB state if eCourts stalls |
| PDF storage (Orders/Judgements) | Vercel Blob, `bom1` store, private | **native** *(critique: verify metadata region)* | Create store in bom1 (immutable); serve via authenticated Function checking `lawyer_id` |
| Caching (free eCourts enum/structure endpoints) | Runtime Cache (TTL+tags) + Edge Config | **native** | Edge Config is globally replicated — **never** put PII there; cuts eCourts credit spend |
| Auth | Clerk *(synthesis)* → **Supabase Auth Mumbai** *(critique)* | **not-native (residency)** | Identity PII has **no India option** on Marketplace auth — mark not-native, full stop |
| Secrets (eCourts Bearer token) | Sensitive Env Vars + Env Var Policy | **native** | Type `sensitive`; rotation must be scripted |
| Security / abuse / credit protection | Vercel Firewall (DDoS free) + WAF rate-limit | **partial** | Rate-limit `/api/refresh` by `lawyer_id`; **WAF counters per-region** — also enforce a hard credit ceiling in Postgres |
| AI foundation (deferred RAG, CNR-scoped) | AI SDK + AI Gateway + pgvector | **not-native (residency)** | Phase-1: add `Document.source` ENUM + CNR FKs now; **AI Gateway has no India inference region; ZDR ≠ residency** |
| Client-portal foundation (deferred) | Next.js route groups + middleware + RLS | **partial** | Remarks excluded by an RLS policy unsatisfiable for client tokens (not routing alone) |

## 3. Reference architecture (maximally-native)

**Stack:** Next.js 16 on Vercel Pro, Functions in Fluid Compute pinned to `bom1`, **Supabase Postgres
(`ap-south-1`)** spine, Vercel Blob (`bom1`) for PDFs, **Supabase Auth (Mumbai)** *(critique: not Clerk)*,
Vercel Cron + **Graphile Worker in Supabase** *(critique: not WDK)*, Sensitive Env Vars, Firewall/WAF + a
Postgres credit counter.

**Spine:** two append-only tables (`court_events`, `remarks`) + `UNION ALL` view in Supabase Mumbai. RLS on
both base tables keyed on `lawyer_id`. Immutability via `BEFORE UPDATE/DELETE` triggers **and** revoked
grants (defense in depth). Functions set RLS context via `SET LOCAL` inside an explicit transaction.

**6PM IST sync flow:** Cron fires `'30 12 * * *'` UTC → Route Handler validates `CRON_SECRET` → triggers
the durable worker → fans out per-case (POST eCourts refresh → poll 5–10s → diff field-by-field → append
Events), throttled to the **100/min eCourts cap**, with per-(case, run-date) idempotency, **reconciling all
work since last successful run** (cron can miss/double-fire).

**Manual refresh flow:** Server Action → Route Handler (Fluid, `maxDuration ~30s`, `bom1`) POSTs eCourts
refresh, polls every 1s up to 15s (Fluid bills active CPU, so idle wait is near-free), diffs → appends →
returns; 15s timeout → return current DB state. Prefer Server-Action-triggers-then-client-polls so a slow
eCourts response never holds an HTTP request open.

## 4. What "100% native" requires (checklist + deltas vs the prior arch doc)

**Provision:** Vercel **Pro** (mandatory — region pinning, per-minute cron, extended `maxDuration`, bom1;
Hobby fires cron in a ±59-min window, single-region); Supabase Postgres `ap-south-1`; Vercel Blob in `bom1`;
auth provider; AI Gateway key (deferred).

**Configure:** `fluid:true`; `regions:['bom1']` on all PII functions; Node runtime for sync/refresh;
`maxDuration` per route; Cron `'30 12 * * *'` + `CRON_SECRET`; eCourts token as **Sensitive** env var;
RLS + immutability triggers + revoked grants; `attachDatabasePool()`; Phase-1 AI schema foundations now.

**Deltas vs the prior (non-Vercel) architecture doc:**
- **Graphile Worker → Cron + WDK** *(synthesis)* — but the prior design's always-on Postgres LISTEN/NOTIFY
  worker **cannot run on Vercel (no long-lived daemon).** **Critique reverses this:** keep **Graphile Worker
  in Supabase Mumbai**, triggered by Cron — for transactional enqueue + residency + maturity. WDK is beta and
  has no India persistence residency.
- **Postgres flips Neon → Supabase.** Neon is the most "Vercel-native" pick but is **disqualified by DPDP**
  (no Mumbai). Supabase `ap-south-1` is the compliant substitute (third party, but standard Postgres = portable).
- **Cron is best-effort, not durable.** No transactional enqueue with your DB; build idempotent reconciliation yourself.

## 5. Where it breaks — the non-native residue

| Component | Why not native | Minimal external dependency |
|---|---|---|
| eCourtsIndia API (given) | External by definition | Stays external; Sensitive Env Var + app/DB rate counter |
| Postgres spine (residency) | No first-party Vercel Postgres; Neon has no India region | **Supabase `ap-south-1`** (portable via `pg_dump`) |
| Durable job state (residency) | WDK/Queues persistence region not selectable | Pass **opaque case IDs only** through any Vercel queue, OR run **Graphile in Supabase Mumbai** |
| Identity PII (residency) | No Marketplace auth in India | **Supabase Auth / Keycloak / Ory in `ap-south-1`** — breaks Vercel-native for auth |
| AI inference (residency) | AI Gateway has no India region; ZDR ≠ residency | BYOK to an India endpoint, or keep AI deferred |
| Audit-grade log retention | Native retention short + US control-plane | **Log Drain → India-hosted SIEM** |
| Contractual DPDP compliance | Vercel DPA is GDPR-focused, no India addendum; control plane US | Legal review + Enterprise tier for formal DPA |

## 6. Recommendation (synthesis)
**Pragmatic hybrid, not 100% native**, split along the residency boundary: keep frontend/compute/refresh/Blob/
cache/firewall/secrets/Cron on Vercel (`bom1`); move the **Postgres spine to Supabase Mumbai** and the
**durable queue to Graphile Worker in Supabase Mumbai**. Cost delta is immaterial; the deciding factor is DPDP
defensibility. Defer AI + client portal as schema foundations only.

---

## 7. Extreme adversarial critique — corrections to §1–6

The synthesis reaches a hybrid recommendation but is **too charitable to the native ceiling** and mislabels
several things as "native."

**(a) Residency holds for almost nothing on the native path.** Litigant data rests outside India in *four*
places, two of which the synthesis miscounts as native:
- **Identity is the hardest break, not Postgres.** Postgres has a clean escape (Supabase Mumbai,
  `pg_dump`-portable). Identity does **not** — "no India option exists" for any Marketplace auth, yet the
  synthesis still lists Clerk and calls the mechanism "native." The IdP holds the lawyer↔client graph in the
  US. Mark it **not-native, full stop.** Start on **Supabase Auth Mumbai**.
- **Logs are data-at-rest too.** Function logs carry CNRs, party names, PII in stack traces, US-processed by
  default. Until a Log Drain exists, *every PII request logs to a US control plane on day one* — a violation,
  not a phase-2 nicety.
- **The control plane is an irreducible US sub-processor.** `bom1` pins data-plane compute + Blob bytes only.
- **Blob caveat:** verify Blob *metadata/indexing* (not just object bytes) stays in-region before trusting it.
- **Bottom line:** *Vercel-native and DPDP-compliant are mutually exclusive for this product today.*

**(b) Durable sync — Cron + WDK is a downgrade here.** The Postgres-native worker had **transactional
enqueue** (append Event + advance job in one transaction = exactly-once for free). Moving the queue to
WDK/Queues loses that — two systems, no shared transaction, app-level idempotency keys are the *symptom* of
giving it up. Plus: cron has no SLA for the product's core job; **cold start at 6PM is real** (Fluid's
warm-instance halo applies to manual refresh, *not* a once-daily batch); full-run wall-clock can exceed a
single function's ceiling; and **credit-burn amplification** — a durable step that fails *after* the billed
eCourts POST but *before* recording success re-POSTs on retry → double credit. Idempotency must guard the
**billable call**, not just the DB write. → Use **Graphile in Supabase Mumbai**.

**(c) Lock-in is inverted.** The synthesis frets about the *portable* component (Postgres) and waves through
the *sticky* one — **Next 16 + Server Actions + Fluid + `attachDatabasePool`** is deep Vercel-runtime
coupling. **WDK** code (`use step`) is non-portable; betting the core workflow on beta = a rewrite risk.
**Clerk** = the worst migration in software, signed up for twice (US now → India later). Real cost axis is
**eCourts credit spend**, not the $40-vs-$54 infra delta.

**(d) Maturity — two items are disqualifying-until-GA, not caveats.** **WDK (beta)** must not host the core
daily court-monitoring job. **Vercel Queues** — same family, same concern. Fluid `attachDatabasePool`
suspension semantics = a sharp edge to test hard. Supabase RLS-via-JWT-on-pooled-connection = high-care
(leaked RLS context = catastrophic cross-tenant leak). **Schema** foundations are reversible (do them now);
**runtime** bets on beta are not.

**(e) Honest numbers:** max native **~55–65%** (not 75–80%) — the entire stateful/durable/identity tier is
off-platform. Genuinely-native residue: frontend, manual-refresh compute, Blob, Runtime Cache/Edge Config,
Firewall/WAF, Sensitive Env Vars, Cron-as-trigger. The 5 locked decisions are promoted to **§0**.

**One-sentence verdict:** *100% Vercel-native is structurally impossible for this product (US control plane +
no India identity option + no durable-state residency); chasing it would put litigant PII outside India and
the core daily job on beta infra — so split deliberately: Vercel for stateless `bom1` compute + delivery,
Supabase-Mumbai for the entire data-and-durability tier (~55–65% native), keeping every off-platform piece a
connection-string away from portability.*
