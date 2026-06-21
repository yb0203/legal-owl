---
name: Legal Owl Architecture
last_updated: 2026-06-20
status: canonical — source of truth for technical direction
---

# Legal Owl — Architecture

This is the canonical, finalized architecture for Legal Owl. It is the technical counterpart to
`STRATEGY.md` (which remains the source of truth for product direction). When code lands, keep this
document current.

**Product framing:** an **AI-native legal office** for solo Indian litigation lawyers to manage **cases and
clients** elegantly. AI is woven through the product (not a bolt-on, not chat-first); the dashboard stays the
primary surface. The core bet — every AI answer/draft is **traceable to real case data** — is enforced
architecturally, not aspirationally.

**Stack:** **Vercel** (Mumbai `bom1`) for the stateless edge + **Supabase** (Mumbai `ap-south-1`) for the
entire data + durability + identity tier.

**Build philosophy:** foundation → AI on top. Build a clean, populated case spine first; layer AI over real
data. Build the **agent-native typed-action layer from day one** (near-free, and it *is* the AI-native
foundation).

> Supporting research: `docs/research/ai-native-legal-office.md`,
> `docs/research/vercel-supabase-reference-architecture.md`,
> `docs/research/architecture-ideas-from-legal-systems.md`,
> `docs/research/vercel-native-feasibility.md`. Requirements:
> `docs/specs/court-monitoring.md` (court monitoring), `docs/specs/case-management.md` (case management).

---

## 1. Shape

Vercel runs the *stateless, in-region* edge: Next.js app, API/Server Actions, manual-refresh compute, the
cron *trigger*, and a PDF-serving auth gate. **Supabase-Mumbai owns everything stateful and
identity-bearing**: the Postgres spine, Auth, Storage, the durable sync worker (pg_cron + pgmq), Realtime,
and the future pgvector RAG store. All data-at-rest is in India; only transient LLM prompt text crosses the
border (permitted under DPDP §16 — see §10).

## 2. Data spine (built first)

- **Two append-only tables** — `court_events` (written only by the sync worker) and `remarks` (written only
  by the lawyer) — merged at read time via a **`UNION ALL` view** over shared columns
  (`case_id, occurred_at, source_type, kind, display_text, metadata`). **Not** event sourcing; **not** a
  trigger-based audit sidecar (those tables *are* the audit trail).
- **`cases`** keyed on **CNR (`NOT NULL`)**: `case_type`, `establishment_id`, `stage`, **parties as JSONB**
  (not a junction — the CRM is deferred), `acts_sections` JSONB, `next_hearing_date` (a projection written
  only by the sync job, never the user), `last_event_at`, `last_successful_sync_at`, `lawyer_id` (RLS), and a
  **lifecycle state** (`pending_first_sync | active | not_found | disposed`) for the unhappy path.
- **`source_type`** on events (`ecourt | lawyer_manual | system`) and **`source`** on documents
  (`court_order | judgement | lawyer_upload | generated`) — the two "lay it now" fields; they are the
  client-visibility AND AI-grounding boundary.
- **Immutability** of `remarks`: `BEFORE UPDATE/DELETE` trigger **and** revoked UPDATE/DELETE grants on the
  app role (defense in depth). Corrections to court data = a new `data_correction` event referencing the
  original, never a mutation.
- **RLS on every table keyed on `lawyer_id`.**
- **`sync_runs`** ledger: `raw_response` JSONB, `scheduled_at`/`processed_at`, `state`, counts, and
  `UNIQUE (case_id, run_date)` for idempotency.

## 3. Agent-native action layer (the organizing principle)

Every mutation — `registerCase`, `refreshCase`, `addRemark`, `linkClient`, `draftClientUpdate`,
`sendClientUpdate`, `generateHearingBrief`, … — is defined **once** as a typed action (zod schema + `run`).
That single definition is simultaneously a **UI action** (Server Action), an **HTTP endpoint**, and an
**AI/agent tool**. This makes the office genuinely agent-native at near-zero extra cost and is the seam a
future MCP server wraps.

- **Build now:** the internal typed-action layer.
- **Defer:** the public MCP server (users are non-technical solos).
- **Outbound actions** (client send, anything filed) default to **draft / approve-before-act**.

## 4. Court monitoring sync (durable, idempotent)

- **Scheduler = Supabase `pg_cron`** at `30 12 * * *` (UTC = 6:00 PM IST; fixed offset, no DST). Enqueues one
  **`pgmq`** message per `(case_id, run_date)` in a transaction that also writes the `sync_runs` row →
  transactional, exactly-once per run; a double cron fire is a no-op.
- **Drain** = a separate pg_cron tick (or Edge/Vercel function) reading pgmq batches throttled to the eCourts
  ~100/min cap.
- **Idempotency guards the BILLABLE call, not the DB write.** Claim the run
  (`UPDATE ... SET state='posting' WHERE state='queued' RETURNING`); record the eCourts async-POST **token**
  *before* polling; on retry **resume polling the token instead of re-POSTing** (prevents double credit-charge
  after a crash). Only after the diff is appended → delete the pgmq message + `state='done'`. Field-by-field
  diff (not full-response hash); `content_hash` per event row.
- **Reconciliation:** the enqueue job re-enqueues any prior-day `queued/posting` runs → cron gaps self-heal.
  `last_successful_sync_at` + a staleness banner (>24h) surface trust.
- **Manual refresh** = a single Vercel **Fluid** function (`maxDuration ~30s`): POST → poll every 1s up to
  15s. Prefer Server-Action-triggers-then-client-polls so a slow portal never holds an HTTP request open.
- **Bulk CNR import** = the Excel-replacement onramp: paste/upload CNRs → enqueue first-sync each →
  auto-create cases. Ships in Phase 1.

## 5. Case management + timeline

Case auto-created on registration; auto-composed title (`{Petitioner} vs {Respondent} · {Forum}`). The
**unified timeline** is the `UNION ALL` view rendered in an RSC, with pinned fields (status, next hearing,
parties, court) above it; add-Remark writes to `remarks`. Case list sorted by `next_hearing_date` ascending
(no-date cases last).

## 6. Client management (records + AI-drafted updates)

- **`clients`** entity + **`case_clients`** join (RLS-ready); client name surfaced on the case.
- **`client_updates`** publish surface: the lawyer triggers (or the system proposes on a new court event) an
  **AI-drafted, lawyer-approved** plain-language update derived from the case timeline.
- **Channel:** Phase 1 = **email + a no-login status link**; **WhatsApp + vernacular** is the designed
  fast-follow (research calls WhatsApp the real India wedge — see §12).
- **Content-type exclusion** for the future portal: client tokens get an RLS policy on `remarks` that is
  *unsatisfiable* — work-product can never join a client response. Build the join + policy now; defer the
  client login surface.

## 7. AI layer (foundation now, grounded assistant after the spine is populated)

- **Lay now (schema only, zero runtime AI dependency):** `documents` (`source` enum, `cnr`, `lawyer_id`,
  `storage_path`) and `document_chunks` (`embedding vector(...)`, `cnr`, `lawyer_id`); enable the `vector`
  extension. CNR-scoped retrieval isolation enforced by RLS, not just app code
  (`WHERE lawyer_id = auth.uid() AND cnr = $1`).
- **Then "AI on top":** start the assistant grounded in the **already-clean structured timeline** (events +
  remarks + eCourts fields), CNR-scoped — an AI-native feel *without* the chunking/embeddings pipeline, and it
  can only ground on data the spine guarantees is real.
- **Trust mechanics are first-class primitives** (the core bet made real):
  - **Citation ledger** — every AI assertion links to a source span (eCourts field / order page / remark);
    unlinkable claims don't render.
  - **Abstention by default** — "not in the case file" instead of filling gaps. Measure it.
  - **Deterministic deadline/limitation math** — computed by rules over real data (Limitation Act 1963); AI
    explains/flags, never computes the date.
- **Highest-leverage first artifacts** (all grounded in owned data): hearing-prep brief, case-grounded chat,
  event-triggered client update.
- **AI-slop traps to avoid:** open-web legal research / generated citations, LLM-computed limitation dates,
  autonomous send, generic ungrounded "legal chat."
- **Inference:** Vercel AI SDK + AI Gateway (Claude primary) with `zeroDataRetention: true` + provider DPA;
  **BYOK** kept as the lever so an in-India inference endpoint is a credential swap. Durable copy of all case
  text stays in Mumbai; only transient prompt text leaves.

## 8. Auth, tenancy, connections, storage, realtime

- **Auth = Supabase Auth (Mumbai).** JWT `sub` → `lawyer_id` for RLS. Two-surface (lawyer vs future client)
  via a `user_type` claim.
- **RLS from serverless:** prefer PostgREST/supabase-js with the user's JWT (auto-sets claims). For raw SQL
  over the pooled connection (the `UNION ALL` view, complex joins), wrap in an **explicit transaction +
  `SET LOCAL`** (safe under transaction-mode pooling). **Never plain `SET`** on a pooled connection
  (cross-tenant leak — the highest-severity bug class here). Parameterize claims.
- **Connections = Supavisor transaction mode (6543)** for Vercel Functions; `attachDatabasePool()`; direct
  connection (5432) only for migrations + in-DB pg_cron/pgmq.
- **Storage = Supabase Storage (Mumbai)** for Order/Judgement PDFs + uploads; RLS on `storage.objects` keyed
  on `lawyer_id`; short-TTL signed URLs minted by a Vercel auth-gate function. (Chosen over Vercel Blob for
  the shared RLS model; residency is a tie.)
- **Realtime = Broadcast-from-Database** (trigger → `realtime.broadcast_changes()` into private per-case
  channels with RLS on `realtime.messages`) for live timeline / manual-refresh feedback and the future client
  dashboard. Cheap to add now; matters most for manual refresh + portal.

## 9. Recommended query/runtime stack

Next.js 16 App Router (RSC + Server Actions), shadcn/ui; a thin query layer (`pg`/Drizzle) for the spine so
the `SET LOCAL`-in-transaction RLS pattern is clean (avoid Prisma's prepared-statement friction with
Supavisor, or set `pgbouncer=true` if Prisma is chosen); supabase-js for Auth/Storage/Realtime.

## 10. Residency gaps + minimal mitigations (honest residue)

- **LLM inference cross-border** — no in-India Claude path today; **permitted under DPDP §16 blacklist** (no
  restricted countries notified as of mid-2026). Mitigate: ZDR + DPA + BYOK lever + durable copy in Mumbai.
- **Vercel US control plane** (deploy metadata, env-var names, build logs, WAF analytics) — irreducible US
  sub-processor; `bom1` pins data-plane + Blob bytes only. Record in the sub-processor register; never put PII
  in env-var values.
- **Function/platform logs** can contain PII → configure a **Log Drain to an India sink before the first PII
  endpoint ships**; scrub PII; never log full request bodies.

## 11. Explicitly deferred (boundaries laid, not built)

Full RAG-over-PDFs (chunking/embeddings/hybrid retrieval/bounding-box citations) until the document corpus is
populated; client login portal + automated multi-channel notification delivery; public MCP server;
CaseParty/Contact CRM normalization; forum abstraction / multi-forum identifiers; bi-temporal axis;
cause-list fan-out credit optimization; autonomous send.

## 12. Decisions locked (and supersessions)

- **pg_cron + pgmq supersedes Graphile Worker** for the durable sync (now that Supabase is the chosen tier;
  pgmq is GA and lower-ops). Idempotency must guard the billable eCourts call.
- **Supabase Storage over Vercel Blob** (shared RLS model).
- **Supabase Auth over Clerk** (India residency; identity holds the lawyer↔client graph).
- **DPDP §16 correction** to `vercel-native-feasibility.md`: cross-border AI inference is *permitted
  today* (blacklist model), not a hard blocker; mitigate contractually.
- **Agent-native = internal typed-action layer now; public MCP later.**
- **Client update channel:** Phase 1 = email + no-login status link; WhatsApp + vernacular fast-follow.
- **Query layer:** `pg`/Drizzle for the spine + supabase-js for Auth/Storage/Realtime.

## 13. Phase-1 build sequence (walking skeleton → AI on top)

1. **Spine + tenancy** — Supabase Mumbai project (extensions `pg_cron`, `pgmq`, `vector`, `vault`); `cases` +
   `court_events` + `remarks` + `UNION ALL` view + RLS + immutability; Supabase Auth; the **typed-action layer**
   scaffolding. Vercel Pro, `fluid:true`, `regions:['bom1']`; Supavisor transaction-mode wiring; **Log Drain to
   India sink** before any PII endpoint.
2. **Sync** — one-case manual refresh (Fluid function) → field-diff → append events → update projections.
3. **Bulk CNR import** (Excel onramp) feeding the sync.
4. **Case timeline UI** (RSC over the view) + add-Remark.
5. **Daily sync** via pg_cron + pgmq with the billable-call idempotency pattern + staleness banner.
6. **Client records + AI-drafted updates** (email + no-login status link), approve-before-send.
7. **AI on top** — case-grounded chat over the structured timeline + citation ledger + abstention +
   deterministic deadline engine + hearing-prep brief. (RAG-over-PDFs stays deferred.)

## 14. Verification (when code lands)

End-to-end: sync a real CNR and confirm the full event history appears on the timeline; add a remark and
confirm it interleaves chronologically and cannot be edited/deleted. Tenancy: confirm two lawyer accounts
cannot see each other's cases (RLS) including via the raw-SQL `UNION ALL` path. Sync safety: confirm a double
cron-fire produces no duplicate events and no double eCourts charge; confirm a crash mid-poll resumes the
token without re-POSTing. Residency: confirm Postgres, Storage, and Auth are all in `ap-south-1` and a Log
Drain to an India sink is live before any PII endpoint ships.
