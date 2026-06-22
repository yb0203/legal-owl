# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

The production app lives in **`apps/web`** (Next.js App Router on Vercel + Supabase in Mumbai). A
Streamlit eCourts prototype lives in `prototype/ecourts-streamlit/` (reference only; it has its own
pytest suite and migrations — the web app does not). `STRATEGY.md` is the source of truth for product
direction; `docs/ARCHITECTURE.md` and `docs/specs/` are the durable technical/requirements docs, with
supporting `docs/research/`, `docs/plans/`, and `docs/design/frontend-design-learnings.md`.

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
  app's `middleware.ts`). RLS on every table keyed on `auth.uid() = lawyer_id`. Schema in
  `supabase/migrations/` (`config.toml` alongside); apply with `supabase db push --db-url "$DBURL"`
  using the session pooler (URL-encode the DB password with `safe=''` — a literal `/` in it
  otherwise breaks URL parsing). Private Storage bucket `case-documents` holds uploaded files at path
  `${lawyer_id}/${matter_id}/<file>`. Outbound email goes through **Resend** (`lib/email.ts`).
- **Domain hierarchy: Client → Engagement → Matter → Action** (a "General" engagement is
  auto-created per client). Matter is the case file (internal id + optional CNR); Action is the
  task. Hearings, Deadlines, Documents, append-only `court_events` + immutable `remarks` (merged at
  read time into the timeline), and `triage_items` (the Inbox) all hang off Matter.
- **UI: shadcn on the Base UI registry (NOT Radix).** `components.json` style is `base-nova`,
  base color `neutral`, icons `lucide`. Components use the `render` prop, not `asChild`; Base UI
  `Button`/menu items default to `type="button"` (always set `type="submit"` on form buttons). Add
  components via the shadcn MCP / CLI. Toasts use `sonner`; the command palette uses `cmdk`. Shared
  design-system atoms live in `components/` (`badges.tsx`, `page-header.tsx`), shared types/utils in
  `lib/types.ts` and `lib/format.ts` (dates render `dd-MMM`), data helpers in `lib/db.ts`, and
  `lib/auth.ts` / `lib/redirect.ts` / `lib/utils.ts` round out the helpers.
- **Nomenclature (neutral-professional):** nav is `Home · Calendar · Matters · Inbox · Tasks ·
  Clients · Settings`. Internal `workflow_states` names (To-Do, Awaiting Filing, …) are rendered via
  `StatusBadge`.
- **Theme is a deliberate off-dark mint/lemon palette** (`app/globals.css`), chosen by the user —
  do NOT "fix" it back to the light "legal ledger" look described in `docs/design/`. Fonts: Geist
  (sans), Geist Mono (case numbers/CNRs), Source Serif 4 (headings).
- Secrets live in gitignored `.env` (root: Supabase admin/`SUPABASE_DB_PASSWORD`, `RESEND_API_KEY`,
  `ECOURTS_API_KEY`) and `apps/web/.env.local` (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY`) — never commit them. No `.env.example` exists yet.

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
