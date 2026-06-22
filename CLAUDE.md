# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

The production app lives in **`apps/web`** (Next.js App Router on Vercel + Supabase in Mumbai). A
Streamlit eCourts prototype lives in `prototype/ecourts-streamlit/` (reference only). `STRATEGY.md`
is the source of truth for product direction; `docs/ARCHITECTURE.md` and `docs/specs/` are the
durable technical/requirements docs.

### Web app — `apps/web`

Commands (run inside `apps/web`):

- `npm run dev` — local dev server (Turbopack)
- `npm run build` — production build (runs `tsc` typecheck + route generation; the green-build gate)
- `npm run lint` — ESLint (Next)
- `npm run typecheck` — `tsc --noEmit`

There is **no test suite yet**; `npm run build` is the correctness gate after changes.

Architecture & conventions:

- **Next.js App Router.** Authenticated app under the `app/(app)/` route group, gated by
  `app/(app)/layout.tsx` (auth + waitlist `has_access`). Public routes: `/`, `/login`, `/waitlist`.
  Reads happen in Server Components; writes are **Server Actions** co-located in each route's
  `actions.ts` (form actions read a hidden id; programmatic actions take args and are called from
  client islands via `useTransition`).
- **Supabase** (`@supabase/ssr`, cookie-per-request). RLS on every table keyed on
  `auth.uid() = lawyer_id`. Schema in `supabase/migrations/`; apply with
  `supabase db push --db-url "$DBURL"` using the session pooler (URL-encode the DB password with
  `safe=''` — a literal `/` in it otherwise breaks URL parsing). Private Storage bucket
  `case-documents` holds uploaded files at path `${lawyer_id}/${matter_id}/<file>`.
- **Domain hierarchy: Client → Engagement → Matter → Action** (a "General" engagement is
  auto-created per client). Matter is the case file (internal id + optional CNR); Action is the
  task. Hearings, Deadlines, Documents, append-only `court_events` + immutable `remarks` (merged at
  read time into the timeline), and `triage_items` (the Inbox) all hang off Matter.
- **UI: shadcn on the Base UI registry (NOT Radix).** Components use the `render` prop, not
  `asChild`; Base UI `Button`/menu items default to `type="button"` (always set `type="submit"` on
  form buttons). Shared design-system atoms live in `components/` (`badges.tsx`, `page-header.tsx`),
  shared types/utils in `lib/types.ts` and `lib/format.ts` (dates render `dd-MMM`), shared data
  helpers in `lib/db.ts`.
- **Nomenclature (neutral-professional):** nav is `Home · Calendar · Matters · Inbox · Tasks ·
  Clients · Settings`. Internal `workflow_states` names (To-Do, Awaiting Filing, …) are rendered via
  `StatusBadge`.
- **Theme is a deliberate off-dark mint/lemon palette** (`app/globals.css`), chosen by the user —
  do NOT "fix" it back to the light "legal ledger" look described in `docs/design/`. Fonts: Geist
  (sans), Geist Mono (case numbers/CNRs), Source Serif 4 (headings).
- Secrets live in gitignored `.env` (root) and `apps/web/.env.local` — never commit them.

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
