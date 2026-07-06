# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

The production app lives in **`apps/web`** (Next.js App Router on Vercel + Supabase in Mumbai). A
Streamlit eCourts prototype lives in `prototype/ecourts-streamlit/` (reference only; it has its own
pytest suite and migrations — the web app does not). `STRATEGY.md` is the source of truth for product
direction; `docs/ARCHITECTURE.md` and `docs/specs/` are the durable technical/requirements docs, with
supporting `docs/research/`, `docs/plans/`, `docs/runbooks/`, `docs/brainstorms/`, and
`docs/design/frontend-design-learnings.md`.

### Web app — `apps/web`

Stack: Next.js 16 (App Router, Turbopack by default), React 19, Tailwind v4, TypeScript strict
(`@/*` → `apps/web/*`). The repo root has its own `package.json` (only the `shadcn` CLI) and a
`.mcp.json` registering the **shadcn MCP server**; all app work happens in `apps/web`.

Commands (run inside `apps/web`):

- `npm run dev` — local dev server
- `npm run build` — production build (runs `tsc` typecheck + route generation; the green-build gate)
- `npm run lint` — `next lint` (deprecated in Next 16; there is no ESLint config, so don't rely on it)
- `npm run typecheck` — `tsc --noEmit`

There is **no test suite yet**; `npm run build` (and `npm run typecheck`) is the correctness gate after
changes.

Architecture & conventions:

- **Next.js App Router.** Authenticated app under the `app/(app)/` route group, gated by
  `app/(app)/layout.tsx` (auth + waitlist `has_access`). Public routes: `/`, `/login`, `/waitlist`.
  Reads happen in Server Components; writes are **Server Actions** co-located in each route's
  `actions.ts` (form actions read a hidden id; programmatic actions take args and are called from
  client islands via `useTransition`).
- **Supabase** (`@supabase/ssr`, cookie-per-request). Clients live in `lib/supabase/`
  (`client.ts` browser, `server.ts` RSC/actions, `middleware.ts` session refresh wired through the
  app's `proxy.ts` — the Next.js 16 rename of `middleware.ts`). RLS on every table keyed on
  `auth.uid() = lawyer_id`. Schema in
  `supabase/migrations/` (`config.toml` alongside); apply with `supabase db push --db-url "$DBURL"`
  using the session pooler (URL-encode the DB password with `safe=''` — a literal `/` in it
  otherwise breaks URL parsing). Private Storage bucket `case-documents` holds uploaded files at path
  `${lawyer_id}/${matter_id}/<file>`. Outbound email goes through **Resend** (`lib/email.ts`).
- **Domain hierarchy: Client → Matter → Task** (task-first model, Linear-inspired). Matter is the
  case file (internal id + optional CNR). The unified **`tasks`** table (`type: task | hearing |
  deadline`, shared columns + a JSONB `attributes` bag for type-specific legal fields) replaces the
  old actions/hearings/deadlines/triage tables — hearings and deadlines are just typed tasks with a
  date. The **Inbox is tasks parked in the system `Triage` state** (accept → To-Do, dismiss →
  Cancelled, snooze → `snoozed_until`); `state_id` is nullable (hearings/deadlines carry none), so
  every task read that feeds a status badge filters `type='task'`. Append-only **`activity`** (one
  immutable timeline: synced `court_event` rows keyed by `unique(matter_id, content_hash)` + your
  `remark` notes, immutability trigger scoped to `kind='remark'`) replaces court_events+remarks.
  **`taggings`** is one polymorphic label join (`target_type: task | matter`, no FK on `target_id`).
  `task_relations` replaces action_relations. Documents and `conflict_flags` still hang off Matter.
  Engagements were dropped. A Vercel Chat SDK-aligned `conversations`+`messages` foundation exists
  (UIMessage `parts`/`metadata` jsonb) but has no UI yet. The eCourts sync coupling point is
  `lib/ecourts/sync.ts`; **interactive** syncs (Sync now / connect-by-CNR pass `{react:true}`)
  additionally fire the `ecourts.synced` ambient event via `lib/agents/react.ts` → `runAmbient` so
  **Court Scout** turns changes into cited proposals — the nightly cron stays deterministic (no LLM
  fan-out at scale).
- **Agent-grounding layer (`lib/agents/` + `lib/actions/`).** Schema-locked, approve-before-act
  agents ground on a span-cited **`facts`** store + **citation ledger** (migration
  `20260705000001_agent_grounding_layer.sql`, applied). Every mutation is a define-once **typed
  action** (`defineAction` → `lib/actions/{fact-create,task-create}.ts`, each `register`ed in a plain
  module so it resolves in any runtime — NOT a `"use server"` file). An agent proposal is a serialized
  typed action parked as a Triage task (`source='agent'`, `attributes.proposal`) and **executed on
  accept** in `inbox/actions.ts` (which imports the action modules so `get(name)` resolves; a bad
  action falls through to a plain accept so it can't brick the Inbox). Deterministic span offsets: the
  model returns a verbatim `quote`, code computes offsets via `lib/facts/resolve-span.ts` (never trust
  model offsets). The persistent **Owl assistant rail** (`components/assistant/assistant-rail.tsx`)
  answers only from the record with sources (abstains otherwise) and shows proposals for approval; a
  minimal **spotlight tour** (`components/tour/product-tour.tsx`) launches from the demo toggle
  (`?tour=1`) and Help.
- **UI: shadcn on the Base UI registry (NOT Radix).** `components.json` style is `base-nova`,
  base color `neutral`, icons `lucide`. Components use the `render` prop, not `asChild`; Base UI
  `Button`/menu items default to `type="button"` (always set `type="submit"` on form buttons). Add
  components via the shadcn MCP / CLI. Toasts use `sonner`; the command palette uses `cmdk`. **Build
  with the design-system primitives, never inline Tailwind for structure:** semantic atoms in
  `components/badges.tsx` (`StatusBadge`, `DueDateBadge`, `HearingPill`, `SourceChip`, …) and
  `components/page-header.tsx` (`PageHeader`, `SectionCard`, `Stat`, `EmptyState`); structural
  primitives in `components/layout.tsx` (`PageShell` — every page's `<main>`; `Panel` and `Callout`
  are polymorphic via `as`; `List` + `ListRow`; `SectionHeading`; `Tag`; `BackLink`) and
  `components/native-select.tsx` (`NativeSelect` for `<select>` in Server-Action forms). Don't
  hand-roll `mx-auto … max-w-3xl`, `divide-y … rounded-xl border`, tone-tinted callout banners, or the
  select class string — use the primitive. Shared types/utils in
  `lib/types.ts` and `lib/format.ts` (dates render `dd-MMM`), data helpers in `lib/db.ts`, nav in
  `lib/nav.ts`, in-app help content in `lib/help/`, and `lib/auth.ts` / `lib/redirect.ts` /
  `lib/utils.ts` round out the helpers.
- **Nomenclature (neutral-professional):** navigation is defined once in `lib/nav.ts` (the single
  source of truth consumed by the sidebar, command palette, and header breadcrumb — keep them from
  drifting). It is grouped the way a lawyer works: **Today** (Home, Inbox, Tasks, Calendar) and
  **Case files** (Matters, Clients), with **Help** and **Settings** in the footer. User-defined
  **labels** (the `matter_labels` table) can be attached to matters/tasks and managed at `/labels`.
  Internal `workflow_states` names (To-Do, Awaiting Filing, …) are rendered via `StatusBadge`.
- **Theme is a deliberate off-dark mint/lemon palette** (`app/globals.css`), chosen by the user —
  do NOT "fix" it back to the light "legal ledger" look described in `docs/design/`. Fonts: Geist
  (sans), Geist Mono (case numbers/CNRs), Source Serif 4 (headings).
- Secrets live in gitignored `.env` (root: Supabase admin/`SUPABASE_DB_PASSWORD`, `RESEND_API_KEY`,
  `ECOURTS_API_KEY`) and `apps/web/.env.local` (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY`) — never commit them. Templates are checked in at
  root `.env.example` (admin/CLI creds) and `apps/web/.env.example` (app-runtime vars); copy and fill.

## Product context

Legal Owl is a workflow-automation + case-grounded AI product for **solo lawyers and small law firms**. The core bet: AI answers/drafts must be traceable to real case data and legal domain knowledge (not generic LLM output), so lawyers can act on them. See `STRATEGY.md` for the full strategy; it is the source of truth for product direction.

The product is organized into four tracks, which is the most likely shape for how code/features will be organized:

- **Court monitoring** — automated tracking of e-courts for case status, judgements, and hearing dates (replaces manual portal checks).
- **Case management** — structured, auto-updated case records replacing Excel. This is the foundation other tracks depend on; automation "lands" here.
- **AI document assistant** — ingests/summarizes case documents and provides a chat interface grounded in specific case files. The core AI differentiator is *grounding in real case data*.
- **Client experience** — automated client update emails and a client-facing dashboard for live case status.

Explicitly **out of scope** (do not build without checking strategy): task management / associate coordination, invoice generation, enterprise law firm targeting.

## Working with the strategy doc

`STRATEGY.md` has YAML frontmatter (`name`, `last_updated`). When editing it, bump `last_updated` (today's date). Keep the document's existing structure (Target problem / Our approach / Who it's for / Key metrics / Tracks / Not working on / Marketing).
