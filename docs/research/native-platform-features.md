# Native Supabase + Vercel features to incorporate

_Actionable checklist mapping platform-native capabilities to Legal Owl's tracks. The architecture
split is already decided in `docs/ARCHITECTURE.md` (canonical) and the reference-architecture research
doc — this file is the "what to actually turn on, and when" view, plus net-new features those docs
don't yet cover. **Governing rule (from ARCHITECTURE.md §1):** nothing holding litigant PII or
coordinating billable external calls lives in a Vercel-managed durable store. Supabase-Mumbai
(`ap-south-1`) owns state/identity/durability; Vercel `bom1` owns the stateless edge._

Status legend: **DECIDED** = already chosen in the architecture, build it · **NET-NEW** = not in the
docs, recommended to adopt · **CAUTION** = usable only within a residency/PII constraint · **DEFER**.

---

## A. Decided — incorporate as you build

### Supabase (state / identity / durability tier)
- **Postgres spine** (DECIDED, core) — all tracks. Append-only `court_events` + `remarks`, merged via a `UNION ALL` view rendered in an RSC.
- **Supabase Auth** (DECIDED) — JWT `sub` → `lawyer_id` for RLS; `user_type` claim for the lawyer/client two-surface split (client-experience track).
- **Supabase Storage** (DECIDED) — Order/Judgement PDFs + AI uploads at `${lawyer_id}/${matter_id}/<file>`; short-TTL signed URLs minted by a Vercel auth-gate function.
- **pg_cron** (DECIDED) — court monitoring. Daily 6 PM IST enqueue at literal `30 12 * * *` (IST is a fixed UTC offset — don't rely on the timezone extension) + a separate drain tick.
- **pgmq / Supabase Queues** (DECIDED, core) — durable per-`(case_id, run_date)` work queue with visibility-timeout retries. Chosen over Graphile Worker and Vercel WDK.
- **Supabase Vault** (DECIDED) — in-DB secrets for pg_cron jobs (they can't read Vercel env vars).
- **Supavisor pooler** (DECIDED) — transaction mode (6543) + `attachDatabasePool()` for all Vercel functions; direct 5432 only for migrations + in-DB pg_cron/pgmq. **RLS must use `SET LOCAL` inside a transaction** — plain `SET` on a pooled connection is a cross-tenant leak (highest-severity bug class).
- **Supabase Realtime — "broadcast from database"** (DECIDED, scoped) — DB trigger → `realtime.broadcast_changes()` into private per-case channels with RLS on `realtime.messages`. NOT raw Postgres Changes. For the live timeline + future client dashboard. "Cheap to add now."
- **pgvector** (DECIDED, **DEFER** runtime) — AI assistant. Add `documents` + `document_chunks(embedding vector(...))` + RLS now; ship retrieval later. CNR-scoped: `WHERE lawyer_id = auth.uid() AND cnr = $1`.
- **Supabase Edge Functions** (RECOMMENDED, narrow) — optional Deno pgmq drain/consumer, regional to `ap-south-1`, longer timeout.

### Vercel (stateless edge tier)
- **Next.js 16 App Router + Server Actions** (DECIDED) — `regions: ['bom1']`.
- **Fluid Compute** (DECIDED) — `fluid: true` + `attachDatabasePool()` on PII functions; manual refresh = single Fluid function, `maxDuration ~30s`, poll ~1s up to 15s.
- **Vercel Cron — trigger only** (DECIDED, scoped) — NOT the daily-sync orchestrator (no SLA, cold start, no transactional enqueue). pg_cron owns the durable schedule; Vercel Cron is at most a redundant ping.
- **Vercel AI SDK + AI Gateway** (DECIDED, **DEFER** runtime) — AI assistant. Claude primary; `zeroDataRetention: true` + provider DPA; BYOK kept as the lever so an in-India inference endpoint is a credential swap. (ZDR ≠ residency.)
- **Firewall / WAF** (DECIDED) — rate-limit `/api/refresh` by `lawyer_id` for eCourts credit protection. WAF counters are per-region, so **also enforce a hard credit ceiling in Postgres**.
- **Sensitive Env Vars** (DECIDED) — eCourts Bearer token + `CRON_SECRET`.
- **Runtime Cache / Edge Config** (DECIDED, scoped) — cache only **free, non-PII** eCourts enum/structure endpoints to cut credit spend. Never put PII in Edge Config (globally replicated).
- **Log Drain to an India sink** (DECIDED, day-one) — function/platform logs can contain CNRs/PII and are US-processed by default. Wire this **before the first PII endpoint ships** — it's a DPDP requirement, not optional observability.

---

## B. Net-new — not in the docs, worth adopting

| Feature | Platform | Track / use | Recommendation |
|---------|----------|-------------|----------------|
| **Point-in-Time Recovery (PITR) + backups** | Supabase | all (legal data durability/compliance) | **ADOPT.** Litigation data loss is unacceptable; enable on Pro. Highest-value safety net the docs omit. |
| **Full-text search (`tsvector` + `pg_trgm`)** | Supabase | case management | **ADOPT before pgvector.** Cheap server-side search across matters/clients/documents — most "find my case" needs don't require embeddings. |
| **Auth MFA (TOTP) + provider options** | Supabase | all | **ADOPT.** Lawyers hold privileged data; TOTP MFA is a low-effort trust/security win. Consider step-up MFA on sensitive actions. |
| **Database Webhooks** (or `pg_net`) | Supabase | client experience | **CONSIDER.** Trigger on `court_event` insert → HTTP → Edge Function → Resend client-update email. Keeps notifications event-driven. (`pg_net` is the in-DB HTTP primitive if the drain itself makes outbound calls.) |
| **Supabase Branching** | Supabase | dev workflow | **ADOPT (with caveat).** Ephemeral per-PR DB branch paired with Vercel Preview Deployments → safe migration testing. Seed with synthetic data only; verify branch region. |
| **Cache Components / PPR** (`use cache`, `cacheLife`/`cacheTag`) | Vercel (Next 16) | marketing + read-heavy shells | **ADOPT for non-PII surfaces.** Landing page and static app shells prerender; stream the per-lawyer data. Do not cache PII responses. |
| **BotID / Attack Mode** | Vercel | court monitoring + auth | **ADOPT.** Protect `/login`, `/waitlist`, `/api/refresh` from bots/abuse; complements the decided WAF rate-limit. |
| **Speed Insights / Web Analytics** | Vercel | marketing only | **CAUTION.** US-processed control plane — fine on public marketing pages, **keep off authenticated PII routes**; rely on the India Log Drain there. |
| **Storage image transforms** | Supabase | AI assistant | **DEFER.** Only if document thumbnails/previews become a need. |
| **Vercel Blob** | Vercel | — | **REJECTED for PII** (no RLS); public/non-PII assets only. |
| **Vercel WDK / Workflow / Queues** | Vercel | — | **REJECTED** — beta, no region pin (PII could leave India). pg_cron + pgmq instead. |
| **OIDC secure connections** | Vercel | — | **N/A for Postgres.** Supabase connects via pooled connection string; keep using Sensitive Env Vars + least-privilege keys rather than over-engineering OIDC. |

---

## C. Open decision (left open in the docs)
- **pgmq drain compute location** — Supabase Edge Function (regional, longer timeout) vs a Vercel Fluid function (warm halo). Recommendation: **Supabase Edge Function** to keep the billable-external-call coordinator inside `ap-south-1`, consistent with the governing rule.

---

## Suggested order
1. **PITR + Log Drain to India** — safety/compliance floor before any PII endpoint.
2. **pg_cron + pgmq + Vault + Supavisor transaction-mode RLS** — the court-monitoring durable spine.
3. **WAF rate-limit + Postgres credit ceiling + BotID** — protect eCourts credits.
4. **Realtime broadcast + Database Webhooks → Resend** — live timeline + client update emails.
5. **Full-text search**, then **pgvector schema now / retrieval later** for the AI assistant.
6. **Cache Components/PPR** on marketing + shells; **Supabase Branching** for the PR workflow.
7. **MFA** before broader rollout.
