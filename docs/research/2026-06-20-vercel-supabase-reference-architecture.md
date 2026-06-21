---
date: 2026-06-20
topic: vercel-supabase-reference-architecture
status: research — feeds docs/ARCHITECTURE.md
method: Vercel + Supabase docs (current, mid-2026) + web research
supersedes_framing_in: 2026-06-19-vercel-native-feasibility.md (DPDP §16 correction; pgmq over Graphile)
---

# Legal Owl Reference Architecture — Vercel (`bom1`) + Supabase (`ap-south-1`)

**One-line shape:** Vercel runs the *stateless, in-region* edge (Next.js app, API functions, manual-refresh
compute, cron *trigger*, PDF-serving auth gate). Supabase-Mumbai owns *everything stateful and
identity-bearing*: Postgres spine, Auth, Storage, the durable sync worker (pg_cron + pgmq), and the future
pgvector RAG store. The only PII that crosses the India border is transient LLM inference text, which DPDP's
blacklist-transfer model permits today (no whitelist/adequacy needed), mitigated by DPA + zero data retention.

## 1. Division of labor

### Vercel owns (stateless, `bom1`)
Next.js 16 App Router UI (`regions:['bom1']`; timeline = `UNION ALL` view in an RSC); API/app layer (Functions,
Node runtime, **Fluid Compute** `fluid:true`, `attachDatabasePool()`); manual refresh (single Fluid function,
`maxDuration ~30s`); **cron as trigger only**; PDF-serving gate (checks `lawyer_id`, mints a Supabase signed
URL); Firewall/WAF; Sensitive Env Vars (eCourts token); Runtime Cache / Edge Config (free eCourts
enum/structure data only — never PII).

### Supabase product-by-product
| Product | Use? | Role in Legal Owl |
|---|---|---|
| Postgres | **Yes — core** | The spine: append-only `court_events` + `remarks`, `UNION ALL` view, RLS on `lawyer_id`, immutability triggers + revoked grants. |
| Auth | **Yes** | Identity in-region (no Marketplace auth hosts identity PII in India). JWT `sub` drives RLS. Two-surface lawyer/client. |
| Storage | **Yes** | Order/Judgement PDFs + uploads, RLS on `storage.objects`, short-TTL signed URLs. |
| Realtime | **Yes, scoped** | Broadcast-from-database for live timeline/status; not raw Postgres Changes at scale (§5). |
| Edge Functions | **Yes, narrow** | Optional pgmq consumer (Deno, longer timeout), regional to `ap-south-1`. A Vercel function can also drain. |
| pg_cron | **Yes** | Schedules the 6PM IST enqueue + the drain tick (§2). |
| Queues / pgmq | **Yes — core** | Durable, transactional per-case work queue with visibility-timeout retries. |
| pgvector | **Yes, deferred** | RAG embedding store, CNR-scoped. Add columns/schema now, ship retrieval later (§4). |
| Vault | **Yes** | Encrypt secrets pg_cron needs in-DB (cron jobs can't read Vercel env vars). |

## 2. Durable 6PM IST sync — recommended pattern

**Decision: Supabase `pg_cron` + `pgmq`, drained by an Edge/Vercel function.** Not Vercel-Cron-as-orchestrator,
not Graphile Worker.
- **vs Vercel Cron alone:** best-effort, no SLA, no transactional enqueue with your DB, real cold start for a
  once-daily batch. Keep Vercel Cron only as an optional redundant trigger.
- **vs Graphile Worker:** Graphile is excellent but a *second daemon*. pgmq (Supabase Queues, GA in 2026) gives
  the same transactional enqueue with one fewer moving part — the lower-ops choice on this stack. *(This updates
  the prior doc's Graphile preference, which was made in a Vercel-without-Supabase context.)*

**Transactional enqueue + idempotency around the BILLABLE call:**
1. **Enqueue (pg_cron, 12:30 UTC):** one transaction inserts one pgmq message per `(case_id, run_date)` and the
   `sync_runs` ledger row with `UNIQUE (case_id, run_date)` → exactly-once per run; double cron fire is a no-op.
2. **Drain (separate pg_cron tick):** read pgmq batches with a visibility timeout, throttled to ~100/min.
3. **Idempotency guards the billable POST, not the DB write:** `UPDATE sync_runs SET state='posting' ... WHERE
   state='queued' RETURNING` — no row → already in flight/done → archive message, no charge. Record the eCourts
   async-POST **token** before polling; on retry **resume polling the token instead of re-POSTing** (prevents
   double-charge after a crash). Only after the diff is appended → delete the message + `state='done'`.
4. **Reconciliation:** the enqueue job re-enqueues any prior-day `queued/posting` runs → cron gaps self-heal.

**pg_cron timezone:** runs in UTC. IST is UTC+5:30 with no DST, so 6:00 PM IST = `30 12 * * *` forever — use the
literal; don't rely on the timezone extension for a fixed-offset zone.

## 3. Auth + tenancy — the SET LOCAL / pooler hazard

Supabase Auth (Mumbai) issues a JWT; RLS keys on `auth.uid()` / `(auth.jwt()->>'sub')` against `lawyer_id`.
- **Preferred:** PostgREST via supabase-js with the user's JWT — sets `authenticated` role + claims per request
  automatically. No manual SET, no pooler hazard.
- **Raw SQL over a pooled connection** (the `UNION ALL` view, complex joins): open an explicit transaction, then
  `SET LOCAL` / `set_config(..., is_local => true)` role + claims, query, COMMIT. Safe under transaction-mode
  pooling (connection returned only at transaction end). **Never plain `SET` / `set_config(..., false)`** on a
  pooled connection → context leaks to the next client → cross-tenant leak (highest-severity bug class). Always
  parameterize claims.
- **Two-surface auth:** one Auth project, `user_type` custom claim. RLS on `remarks` is **unsatisfiable for
  client tokens** — exclusion enforced in the policy, not routing. Build the client↔case join now (RLS-ready).

## 4. AI layer — inference location & residency

Vercel AI SDK + AI Gateway (Claude primary) + Supabase pgvector; CNR-scoped retrieval.
- **No in-India Claude inference today.** Bedrock `ap-south-1` lists Claude but only via Global Cross-Region
  Inference (served from any region) → not guaranteed in-India. Anthropic has a Bengaluru office and is
  "exploring" residency but shipped nothing. So case text to the LLM is a **cross-border transfer**.
- **Permitted under DPDP §16 (blacklist model):** transfer allowed to any country except those notified
  restricted; as of mid-2026 none are notified. So cross-border inference is allowed today; the obligation is
  contractual (DPA) + watching the SDF rules / future notifications. *(More favorable than the GDPR-style reading
  in the prior feasibility doc.)*
- **Mitigations now:** AI Gateway `zeroDataRetention:true`; provider DPA (controller = Legal Owl, no training on
  data); durable copy of all case text stays in Mumbai (only transient prompt leaves); **BYOK** lever so an
  in-India endpoint is a credential swap.
- **Lay foundation now (schema only):** `documents` (`source` enum, `cnr`, `lawyer_id`, `storage_path`);
  `document_chunks` (`embedding vector(...)`, `cnr`, `lawyer_id`); enable `vector`. Every similarity query filtered
  `WHERE lawyer_id = auth.uid() AND cnr = $1` *and* RLS-enforced.

## 5. Realtime

**Yes, but Broadcast-from-Database, not raw Postgres Changes.** Trigger on `court_events`/`remarks` calls
`realtime.broadcast_changes()` into private per-case/per-lawyer channels; RLS on `realtime.messages`; claims
loaded via `set_config` into the authorizing transaction. Scales far better than Postgres Changes (which holds a
replication slot + re-checks RLS per row per subscriber). Matters most for **manual refresh** + the future client
portal (the daily sync is a batch); triggers are cheap to add now.

## 6. Storage — Supabase Storage vs Vercel Blob

**Supabase Storage (`ap-south-1`).** Both region-pin to Mumbai (residency tie), but Supabase Storage integrates
the **same Postgres RLS** (policies on `storage.objects` keyed on `lawyer_id`) — one auth model across spine +
files + realtime; Vercel Blob has no RLS. Short-TTL signed URLs via the Vercel auth-gate function. Keep bytes next
to the DB (and the LLM ingestion path) in Mumbai. Use Vercel Blob only for public, non-PII assets.

## 7. Connection management — Supavisor

**Transaction mode (6543)** for all Vercel Functions (multiplexes many short-lived serverless connections);
`attachDatabasePool()`; `SET LOCAL` is fine in transaction mode (hence the §3 pattern); plain session `SET` is
not. Supavisor supports named prepared statements in transaction mode; Prisma needs `pgbouncer=true` (plain `pg`
with parameterized queries is fine). Direct connection (5432, session mode) only for migrations + in-DB
pg_cron/pgmq.

## 8. Residency gaps + minimal mitigations
| Gap | Reality | Mitigation |
|---|---|---|
| LLM inference cross-border | No in-India Claude; Bedrock = Global CRIS | DPDP §16 permits today; ZDR + DPA + BYOK lever + durable copy in Mumbai; keep AI schema-only until needed |
| Vercel US control plane | `bom1` pins data-plane + Blob bytes, not deploy metadata/env names/build logs/WAF analytics | Record in sub-processor register; no PII in env-var values; Enterprise DPA if a customer demands |
| Function/platform logs | Can contain CNRs/PII, US-processed by default | **Log Drain to India sink before the first PII endpoint**; scrub PII; never log full bodies |
| Supabase management plane | Data in ap-south-1; org/management plane not India-pinned | Note in register; data-at-rest (what DPDP cares about) is compliant |
| eCourts external API | External by definition | Out of scope for our residency; protect the credit token |

## Provisioning checklist
Vercel **Pro** (region pinning, `maxDuration`, bom1); `fluid:true`, `regions:['bom1']` on PII functions; Supabase
Pro in **ap-south-1**; extensions `pg_cron`, `pgmq`, `vector`, `vault`; Storage bucket in Mumbai; `CRON_SECRET` +
eCourts token as Sensitive Env Vars; **Log Drain to India sink before first PII endpoint**; RLS + immutability
triggers + revoked grants on `court_events`/`remarks`; Supavisor transaction-mode for Vercel, direct for
migrations/cron.

### Sources
Supabase Queues / pgmq, pg_cron docs + timezone discussion #36383, Cron+Queue+Edge Function guide; Supabase RLS
discussion #30124, custom claims/testing RLS, Supavisor terminology; Bedrock Global CRIS for Claude in India,
Anthropic Bengaluru announcement, AI Gateway ZDR + BYOK, DPDP §16 cross-border (MediaNama), Supabase automatic
embeddings; Realtime Authorization/Broadcast docs; Storage access control/buckets, Vercel Blob regions; Postgres
connection/pooler docs, Prisma+PgBouncer troubleshooting, `attachDatabasePool` reference.
