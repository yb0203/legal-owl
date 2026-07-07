# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick start

The production app lives in **`apps/web`** (Next.js App Router, deployed on Vercel to Mumbai `bom1` + Supabase in `ap-south-1`).

**Before you code:** read `STRATEGY.md` (product direction) and `docs/ARCHITECTURE.md` (technical decisions).

**Environment setup:**
```bash
cd apps/web
npm install
cp .env.example .env.local  # fill with your Supabase + Resend keys
```

**Commands (run inside `apps/web`):**
- `npm run dev` — local dev server (Turbopack)
- `npm run build` — production build + typecheck (the green-build gate)
- `npm run typecheck` — `tsc --noEmit` (fast feedback during development)
- `npm run lint` — ESLint checks (Next.js defaults)

**Database schema** lives in `supabase/migrations/`. Apply pending migrations:
```bash
cd apps/web
supabase db push --db-url "postgresql://postgres:PASSWORD@db.PROJECTREF.supabase.co:6543/postgres?sslmode=require"
```
(Use the session pooler at port 6543, not 5432. URL-encode the password with `?sslmode=require` if it contains special characters.)

**Verify setup:**
- Dev server starts without errors: `npm run dev` → http://localhost:3000
- Typecheck passes: `npm run typecheck`
- You can log in with magic-link auth (check Supabase → Auth → Users)

## Repository structure

```
STRATEGY.md                # product strategy (source of truth for direction)
CLAUDE.md                  # this file
README.md                  # overview, status, system architecture
docs/
  ARCHITECTURE.md          # technical decisions (append-only timeline, RLS, agent layer, etc.)
  specs/                   # requirements for each track
  design/                  # UI patterns, design learnings
  research/                # reference docs and prior art
  plans/                   # implementation plans
  brainstorms/             # ideation docs
  runbooks/                # operational procedures
apps/web/                  # Next.js app (the product)
  app/                     # Next.js App Router
    (app)/                 # authenticated routes (gated by has_access flag)
      home/                # Home + dashboard (Today feed)
      inbox/               # Court update inbox (triage)
      tasks/               # Cross-matter tasks list
      calendar/            # Agenda view (hearings + deadlines)
      matters/[id]/        # Case file (timeline + documents + activities)
      clients/[id]/        # Client record
      labels/              # Tag management
      settings/            # User preferences
      help/                # Product help + demo tour
      assistant/           # Assistant rail (sidebar)
    login/                 # Magic link auth
    waitlist/              # Waitlist landing
  lib/
    actions/               # Typed action definitions (UI + HTTP + agent tool)
    agents/                # Agent implementations (Court Scout, Limitation Clerk, etc.)
    facts/                 # Facts store (grounding layer) + citation ledger
    supabase/              # DB clients (browser, server, middleware)
    ai/                    # LLM inference layer (OpenRouter, citations)
    ecourts/               # eCourts API integration
    schemas/               # Zod schemas (shared validation)
    help/                  # Help content + demo seed data
    nav.ts                 # Navigation structure (source of truth)
    format.ts              # Date/time formatting, display helpers
supabase/
  migrations/              # database schema (applied via `supabase db push`)
```

## Web app architecture

### Stack

- **Next.js 16** (App Router, Turbopack) with **React 19**, **TypeScript strict** (`@/*` → `apps/web/*`)
- **Tailwind v4**, **shadcn on Base UI** (not Radix; components use `render` prop, not `asChild`)
- **Supabase** (auth, database RLS, storage) with `@supabase/ssr` cookie-per-request
- **Resend** for outbound email

### Routing & Auth

- **Public routes:** `/`, `/login`, `/waitlist`
- **Authenticated app:** `app/(app)/` (gated by `app/(app)/layout.tsx`, checks `has_access` waitlist flag)
- **Server Components** for reads; **Server Actions** for writes (co-located in each route's `actions.ts`, executed via `useTransition`)

### Data model

**Core hierarchy:** Client → Matter → Task

- **`clients`** — lawyer's client records
- **`matters`** — case files (linked to a Client, keyed by optional CNR for eCourts sync)
- **`tasks`** — unified task table (`type: task | hearing | deadline`; JSONB `attributes` bag for type-specific legal fields like hearing dates). Hearings and deadlines are just typed tasks with a `date` attribute.
- **`activity`** — append-only event timeline (immutable; synced `court_event` rows + lawyer `remark` notes, deduplicated by `unique(matter_id, content_hash)`)
- **`taggings`** — polymorphic labels (`target_type: task | matter`, no foreign key on `target_id`)
- **`documents`** — uploaded files in Supabase Storage (`case-documents` bucket at `${lawyer_id}/${matter_id}/<file>`)
- **`conversations` + `messages`** — foundation for future Chat SDK integration (Vercel Chat SDK-aligned with UIMessage `parts`/`metadata` jsonb)

**Key pattern:** Inbox is tasks in the `Triage` state. Every task read that feeds a status badge filters `type='task'` (so hearings/deadlines don't pollute the To-Do list).

### Supabase & RLS

- **Clients:** `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (RSC/actions), `lib/supabase/middleware.ts` (session refresh, wired through `proxy.ts`)
- **RLS:** every table is keyed on `auth.uid() = lawyer_id`. Private Storage bucket `case-documents` is RLS-protected.
- **Raw SQL with RLS:** wrap in an explicit transaction + `SET LOCAL auth.uid()` (safe under transaction-mode pooling). **Never use plain `SET`** on a pooled connection (highest-severity bug class — cross-tenant leak).

### UI conventions

**Theme:** deliberate off-dark mint/lemon palette (user-selectable in settings). Do NOT "fix" it to the light ledger look in `docs/design/` — it was consciously chosen.

**Build with design-system primitives, never inline Tailwind for structure:**
- **Semantic atoms:** `StatusBadge`, `DueDateBadge`, `HearingPill`, `SourceChip` (in `components/badges.tsx`)
- **Structural primitives:** `PageHeader`, `SectionCard`, `Stat`, `EmptyState` (in `components/page-header.tsx`); `PageShell`, `Panel`, `Callout`, `List`, `ListRow`, `SectionHeading`, `Tag`, `BackLink` (in `components/layout.tsx`); `NativeSelect` (in `components/native-select.tsx`)
- **Add new components** via the shadcn MCP: `shadcn@latest add <component>`
- **No hand-rolled:** `mx-auto … max-w-3xl`, `divide-y … rounded-xl border`, tone-tinted callout banners, select class strings

**Navigation:** defined once in `lib/nav.ts` (sidebar, command palette, breadcrumb all consume the same source of truth). Grouped by lawyer workflow: **Today** (Home, Inbox, Tasks, Calendar), **Case files** (Matters, Clients), **Help**, **Settings** (footer).

**Dates:** render as `dd-MMM` (e.g., `06-Jul`) via `lib/format.ts`.

### Agent-grounding layer

The **facts store** (`lib/facts/`) + **citation ledger** (migration `20260705000001_agent_grounding_layer.sql`) anchor every AI assertion to case data.

**Typed actions** (`lib/actions/*`): Every mutation is a define-once typed action (`defineAction` → `lib/actions/{fact-create,task-create}.ts`, etc.). Each is `register`ed in a plain module (not a `"use server"` file) so it resolves in any runtime. An action has:
- **Input schema** (Zod) — validates across all transports
- **`run` function** — the single business logic, receives validated input + context (authed Supabase client + authenticated user + source)
- **Return type** — the data shape the transport returns
- **Name & description** — used for agent tools + audit trails

An agent's proposal is a serialized typed action parked as a Triage task (`source='agent'`, `attributes.proposal`) and **executed on accept** in `inbox/actions.ts`. Because the action is defined once, the UI form, API endpoint, and agent tool all share the same validation and logic — no transport can bypass the schema.

**Deterministic span offsets:** models return a verbatim quote; code computes offsets via `lib/facts/resolve-span.ts` (never trust model offsets).

**Ambient events:** interactive syncs (Sync now / connect-by-CNR pass `{react:true}`) fire the `ecourts.synced` ambient event via `lib/agents/react.ts` → `runAmbient`, so **Court Scout** turns changes into cited proposals. Nightly cron stays deterministic (no LLM fan-out).

**Assistant rail:** `components/assistant/assistant-rail.tsx` answers only from the record with sources (abstains otherwise) and shows proposals for approval.

### Secrets & environment

**Root `.env`** (gitignored): Database and API credentials for local development

| Variable | Purpose | Where to find |
|----------|---------|---------------|
| `SUPABASE_DB_PASSWORD` | Postgres admin password for DB migrations | Supabase project settings |
| `SUPABASE_DB_URL` | Raw Postgres connection (optional; use session pooler URL instead) | Supabase Connection Pooler |
| `RESEND_API_KEY` | Email sending (Resend) | Resend dashboard |
| `ECOURTS_API_KEY` | eCourts India API access | eCourts partner portal |

**`apps/web/.env.local`** (gitignored): Browser-visible and server-only credentials

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL (exposed to browser) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon key (for client-side auth) |
| `RESEND_API_KEY` | Server | Email sending from Server Actions |
| `OPENROUTER_API_KEY` | Server | AI Gateway for agent LLM inference |

**Templates** checked in: `.env.example` (root) and `apps/web/.env.example`. Copy and fill with your credentials.

**Never commit secrets.** Use `gitignore` and templates only. Before pushing, verify no `.env` files are staged: `git status | grep env`

## Product context

Legal Owl is a **workflow-automation + case-grounded AI product for solo lawyers and small law firms in India**. The core bet: AI answers/drafts must be traceable to real case data and legal domain knowledge (not generic LLM output), so lawyers can act on them.

**Four tracks** (likely shape for code/features organization):
1. **Court monitoring** — automated eCourts sync for case status, judgements, hearing dates
2. **Case management** — structured, auto-updated case records (the foundation; automation lands here)
3. **AI document assistant** — chat grounded in specific case files + legal domain knowledge
4. **Client experience** — automated client update emails + future client-facing dashboard

**Explicitly out of scope** (check `STRATEGY.md` before building): task management / associate coordination, invoice generation, enterprise law firm targeting.

## Working with strategy & architecture docs

**`STRATEGY.md`** has YAML frontmatter (`name`, `last_updated`). When editing it, bump `last_updated` to today's date. Keep the structure (Target problem / Our approach / Who it's for / Key metrics / Tracks / Not working on / Marketing).

**`docs/ARCHITECTURE.md`** is the technical source of truth. When code lands, keep it current. It documents:
- Data spine (append-only timeline, RLS, immutability guards)
- Agent-native action layer (typed actions as UI + HTTP + agent tool)
- Sync pattern (durable, idempotent; billable-call idempotency guards the eCourts call)
- Residency strategy (data at rest in India; transient LLM prompts cross-border under DPDP §16)

## Local database development

**Option 1: Supabase CLI (recommended for schema testing)**

```bash
# Start a local Supabase stack (requires Docker)
supabase start

# Your local project is at postgresql://postgres:postgres@127.0.0.1:54322/postgres
# InbandRLS is enabled by default; auth tokens work as normal

# Apply migrations to your local stack
supabase migration list
supabase db push

# Stop the stack
supabase stop

# Reset and replay all migrations
supabase db reset
```

**Option 2: Remote Supabase project (simpler, uses real remote DB)**

Use the remote Mumbai project as your dev environment. Faster to iterate since there's no local Docker overhead, but mutations affect shared data.

**For both options:**
- Point `apps/web/.env.local` to your database (local or remote)
- Test RLS policies with two separate Supabase Auth accounts (confirm `SET LOCAL auth.uid()` isolation works)
- Migrations are additive: create new `.sql` files in `supabase/migrations/` (timestamp-prefixed names)

### Adding a migration

```bash
# Create a new migration file (auto-timestamps)
supabase migration new add_new_column

# Edit supabase/migrations/20260707120000_add_new_column.sql
# Write your SQL (use RAW SQL, not the dashboard — it's version-controlled here)

# Test locally first
supabase db reset  # plays all migrations

# Verify the schema
supabase db pull

# When ready to deploy
supabase db push --db-url "postgresql://postgres:PASSWORD@db.PROJECTREF.supabase.co:6543/postgres?sslmode=require"
```

**RLS policy checklist when adding tables:**
- Add `lawyer_id` column, keyed on `auth.uid()`
- Add RLS policy: `SELECT/INSERT/UPDATE (WHERE lawyer_id = auth.uid())`
- Revoke public defaults: `REVOKE ALL ON table FROM PUBLIC`
- Test with two accounts (confirm isolation)

## Common patterns & gotchas

### Testing

There is **no test suite yet**. When adding tests, prefer:
- **E2E tests** via Playwright (runs against the live app)
- **Integration tests** via Jest + `@testing-library/react` (database + Supabase mocks)
- **Snapshot tests sparingly** (they break easily and hide intent)

Typecheck (`npm run typecheck`) and build (`npm run build`) are the correctness gates until tests are added.

### RLS & database access

- **Browser:** use `@supabase/supabase-js` (auto-sets JWT claims via auth session)
- **Server Components / Actions:** use `@supabase/ssr` client or raw SQL with explicit transaction + `SET LOCAL auth.uid()` (see "Supabase & RLS" section)
- **Never** plain `SET` on a pooled connection (transaction-mode pooling on port 6543)
- **Test tenancy:** confirm two lawyer accounts cannot see each other's cases via RLS or the raw-SQL path

### Sync safety

- **Double cron fires:** `UNIQUE (case_id, run_date)` on `sync_runs` + idempotency token pattern prevents duplicate events and double eCourts charges
- **Crash mid-poll:** record the eCourts async-POST token *before* polling; resume polling the token on retry (never re-POST)
- **Field diffs, not full hashes:** compare field-by-field, dedupe by `content_hash` per event row
- **Reconciliation:** re-enqueue any prior-day `queued/posting` runs so cron gaps self-heal

### Agents & proposals

- **Bad actions:** if an agent action fails, it falls through to a plain accept so it can't brick the Inbox
- **Span offsets:** models return verbatim quotes; code computes offsets via `lib/facts/resolve-span.ts` (never trust model offsets)
- **Abstention:** the assistant answers only from the record with sources; it abstains otherwise ("not in the case file")

### Performance & complexity

- Keep the **data spine clean** (append-only timeline, immutable remarks, projections written only by sync)
- Reads happen in Server Components; mutations are Server Actions (avoid N+1 queries by batching)
- **Realtime** is broadcast-from-database via triggers → private per-case channels (cheap to add now; matters for manual refresh + future portal)

## Adding a typed action

When adding a new mutation (task creation, setting status, etc.):

1. **Define the action** in `lib/actions/{entity}.ts`:
   ```typescript
   import { defineAction } from "./define-action";
   
   export const taskCreate = defineAction({
     name: "task.create",
     description: "Create a new task in the given matter",
     input: z.object({ matter_id: z.string(), title: z.string() }),
     run: async (input, ctx) => {
       const { data, error } = await ctx.supabase
         .from("tasks")
         .insert({ ...input, lawyer_id: ctx.user.id })
         .select()
         .single();
       if (error) throw error;
       return data;
     },
   });
   ```

2. **Register it** in `lib/actions/index.ts` so agents can discover it.

3. **Expose as Server Action** in your route (`app/(app)/tasks/actions.ts`):
   ```typescript
   "use server";
   import { taskCreate } from "@/lib/actions/task-create";
   import { buildActionContext } from "@/lib/actions/define-action";
   
   export async function createTask(input: z.input<typeof taskCreate.input>) {
     const ctx = await buildActionContext("server-action");
     return taskCreate.execute(input, ctx);
   }
   ```

4. **Call from the component** via `useTransition`:
   ```typescript
   const [pending, startTransition] = useTransition();
   startTransition(() => createTask(formData));
   ```

The same `taskCreate.execute()` works for HTTP endpoints and agent proposals — no transport-specific logic.

## Debugging

**Typecheck errors:** run `npm run typecheck` to catch type mismatches early (faster feedback than `npm run dev`)

**Database migration issues:** if `supabase db push` fails, check the error message for SQL syntax or RLS policy conflicts. Preview the migration before applying: `supabase migration list` + `supabase db pull` (never force-push to production)

**RLS leaks:** confirm `SET LOCAL` is used in raw-SQL Server Actions (never plain `SET` on a pooled connection). Test with two accounts to verify isolation.

**Sync stalls:** check `sync_runs` table for `queued/posting` rows older than 24h. Reconciliation will re-enqueue them; manually bump `state` to `queued` if needed.

**Agent proposals not showing:** confirm the typed action is `register`ed in `lib/actions/` and `inbox/actions.ts` imports the module. Check browser console for client-side errors.

## Residency & compliance

**Data at rest:** Postgres, Auth, Storage all in Supabase Mumbai (`ap-south-1`). **Data in transit:** transient LLM prompt text crosses the border (permitted under DPDP §16 — see `docs/ARCHITECTURE.md` §10).

**Before shipping any PII endpoint:** configure a **Log Drain to an India sink** (Vercel → Settings → Integrations → Log Drains). Scrub PII from function logs.

**Sub-processor register:** Vercel US control plane is an irreducible US sub-processor (deploy metadata, env-var names, build logs). Document it in your compliance register.
