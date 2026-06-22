# Matters list — UX benchmark

Surface: the Matters list/index — `apps/web/app/(app)/matters/page.tsx`. The list/index of case
files: internal id (`key`) + optional CNR, status, client, next hearing. The job is browsing,
filtering, and scanning many matters fast.

---

## Current state (Legal Owl)

### What exists today

A single Server Component (`apps/web/app/(app)/matters/page.tsx`) renders:

- **Page header** with title "Matters", subtitle "Your case files.", and a `+ New matter` button
  (`page.tsx:60-64`).
- **A single search input** that searches `title`, `key`, and `cnr` via a Postgres `ilike` OR
  (`page.tsx:66-70`, query at `:50`). Submits as a GET form to `/matters`.
- **Five status filter pills** (All / Active / On hold / Disposed / Archived) rendered as
  pill-shaped links that push `?status=` into the URL (`TABS` at `:21-27`, render at `:72-88`).
  Archived is mutually exclusive (queries `archived_at not null`, others filter it out at `:43-49`).
- **A flat, single-column list** inside a bordered, rounded container with row dividers
  (`page.tsx:103-128`). Each row is a full-width link to `/matters/{id}` showing:
  - line 1: `title` (truncated, `font-medium`)
  - line 2: forum label (`FORUM_LABELS[forum_type]`) · monospace `key` · `· client name`
  - right side: a `HearingPill` (next hearing date) or an em-dash, plus a chevron.
- **Sort** is fixed: next hearing ascending (nulls last), then created desc (`:40-41`). Not
  user-controllable.
- **Empty states** for "no matters yet" (with CTA) and "no matches" (no CTA) via `EmptyState`
  (`page.tsx:90-101`).
- **Width-capped** layout at `max-w-3xl` (`page.tsx:59`).

### Strengths

- **Right primary signal.** Sorting by next hearing surfaces the most time-critical matters first —
  exactly what a litigator scanning the morning wants.
- **Clean, scannable rows.** Two-line row with title + secondary metadata reads well; monospace
  `key`/CNR is the correct treatment for identifiers.
- **Fast to comprehend.** Pills + search + list is a low-cognitive-load pattern, and it loads
  server-side with no client JS for the core view.
- **Good empty-state hygiene** with contextual CTA vs. no-CTA for search.

### Concrete weaknesses

1. **`matter_status` is never shown on a row.** You can filter by status but cannot *see* a row's
   status while scanning (`page.tsx:110-117` renders forum/key/client but no status badge). The
   project already has a `StatusBadge` convention (per CLAUDE.md) — it's simply absent here.
2. **CNR is searchable but invisible.** It's a core identifier (the only link to eCourts), yet it
   never appears in a row. A lawyer cannot copy/verify a CNR from the list.
3. **No sort control and no secondary metadata columns.** Fixed sort means you can't reorder by
   client, by recently updated, or by status. There is no "stage/age/last activity" signal at all.
4. **No counts anywhere.** Filter pills don't show how many matters are Active vs On hold, and there's
   no total record count. A lawyer can't gauge caseload at a glance.
5. **No saved/custom views.** Every lawyer sees the same five canned tabs. No "My hearings this week",
   "Awaiting filing", "By court", or pinned segments.
6. **No grouping.** A long list is undifferentiated — no "This week / Next week / Later" hearing
   buckets, no group-by-status or group-by-court.
7. **No bulk actions / multi-select.** Can't select several matters to archive, change status, or
   reassign client. No row-level quick actions (kebab menu) either — every interaction requires
   opening the matter.
8. **Search is submit-only and slow-feeling.** Requires Enter + full page round-trip; no debounced/
   live filtering, no recent searches, no scoping ("search CNR only").
9. **Overdue hearings aren't differentiated.** `HearingPill` shows a date but the list gives no
   visual escalation for a hearing that is *today* or *overdue* vs. weeks away (worth verifying in
   `components/badges.tsx`, but nothing in this file escalates it).
10. **Density is fixed and generous.** ~56px rows at `max-w-3xl` means a 40-matter docket needs a lot
    of scrolling. No compact density option, no column view for power users.
11. **No pagination / count guard.** The query has no `.limit()` or pagination — a firm with
    hundreds of matters loads everything.

---

## Inspiration gallery

### Pattern A — Dense, sortable, column-based record tables (the power-user default)

**Attio — Companies table** ([mobbin](https://mobbin.com/screens/3b2c7739-3613-4b48-9a40-c4fae75d422d))
- Genuinely dense table: small row icons, tight rows, many columns (Company, Categories, LinkedIn,
  Last interaction, Connection strength) visible at once — a whole book of business on one screen.
  This is what a 100-matter docket should feel like.
- **Inline colored tags** for Categories (B2B / B2C / Enterprise) read as scannable chips, not
  walls of text — directly analogous to forum/court and status chips for Legal Owl.
- **"Connection strength" with a colored dot + label** ("Very strong" green / "Weak" amber) is a
  perfect model for a health/urgency indicator per matter.
- A **header `+` to add columns** and a "Add calculation" footer per column (count/rollups) — the
  list doubles as a lightweight analytics surface.

**Attio — column header menu** ([mobbin](https://mobbin.com/screens/3c2d207c-037e-495b-b6c8-50fe3045ed0c))
- Click any column header → Sort ascending/descending, Move left/right, Edit label, Hide from view.
  Sorting and column management live exactly where the user's eye already is. No separate settings.

**Attio — add-column attribute picker** ([mobbin](https://mobbin.com/screens/aff01634-e2a4-48f8-9890-d6be49651c3d))
- A searchable attribute list (Record ID, Domains, Team, Categories, Primary location…) lets users
  compose their own columns. For Legal Owl this maps to letting a lawyer choose CNR / court / next
  hearing / last activity / opposing party as visible columns.

**Zoho CRM — Deals list** ([mobbin](https://mobbin.com/screens/f308bf7c-ceff-4018-9a19-68a8a6fc6073))
- Classic records table with checkboxes, sortable columns, and a **left "Filter Deals by" rail**
  with both system-defined filters and Filter-By-Fields. Dates in the Closing Date column show
  **colored date chips ("Mar 19", "Today", red for near/overdue)** — a strong model for hearing-date
  escalation in the list itself.
- A persistent **"Total Records 14" + pager (1 to 14)** footer — the count guard Legal Owl lacks.

**Salesforce — Cases list view** ([mobbin](https://mobbin.com/screens/bf33c8f7-e5a0-48d5-9665-d7d8a8e26509))
- The closest 1:1 to Legal Owl's domain: columns are **Case Number, Subject, Status, Date/Time
  Opened, Case Owner**, with a **"Recently Viewed" view switcher** at the top and per-column sort
  carets. Case Number as a monospace-ish first column + Status column is exactly the matters shape.

**Jira — List view** ([mobbin](https://mobbin.com/screens/00be130b-6157-4723-a081-76946a52ba90))
- Columns for Assignee, Due date, **Priority shown as compact colored icons**, Labels, Created,
  Updated, Reporter. Priority-as-icon keeps the row dense while still scannable — a model for
  showing matter status/urgency without a wide text badge.

### Pattern B — Status as a first-class, scannable signal (grouped lists)

**Linear — issue list grouped by status** ([mobbin](https://mobbin.com/screens/9dbb6bc7-e6b0-4fb5-bc03-83d447df928b))
- **Status is the grouping axis** (Backlog / Todo / In Progress / Done as labeled sections with
  counts). Each row carries a status glyph, the monospace id (SLM-18), title, and trailing metadata.
  A lawyer could see matters grouped by workflow state (To-Do / Awaiting Filing / …) with counts,
  turning the list into a pipeline.
- **Extreme row density and calm typography** — many rows per screen, no heavy borders. This is the
  density target for an off-dark theme.

**Linear — inline filter chips + grouped rows** ([mobbin](https://mobbin.com/screens/5a95254a-1edb-4333-a591-f5b2eb14be1a))
- Active filter shown as a removable **"Priority is High ×" chip** beside a `+` add-filter; rows
  group under "In Progress / Todo" with counts, and trailing metadata (labels, due date, assignee
  avatar) sits right-aligned. The chip pattern is far better than Legal Owl's binary status pills for
  composing multiple conditions (e.g. court = HC AND hearing this week).

**ClickUp — list with inline status dropdown + bulk action bar** ([mobbin](https://mobbin.com/screens/e9639493-e0a6-46c9-93d1-d3189cbdc3c7))
- **Inline status change** via a per-row status menu (Not started / In Research / In Design / …) —
  change status without leaving the list.
- **Multi-select with a floating bottom action bar** ("3 Tasks selected · Status · Assignees · Dates
  · Move/Add · Copy · More"). Exactly the bulk-edit affordance Legal Owl needs for archiving or
  status changes across many matters.

### Pattern C — Saved views & segments (turn one list into many)

**Linear — Views list** ([mobbin](https://mobbin.com/screens/0eb0ef0f-7e0f-4507-a314-86e7924b2b21))
- A library of saved views ("Medium Priority — Issues with medium priority", "High Priority Tasks —
  Issues marked as High Priority"), each with a name + human-readable description + owner, split into
  Personal vs Workspace. Legal Owl's five hard-coded tabs could become user-creatable saved views
  ("HC hearings this week", "Awaiting filing").

**Sentry — New View with suggested queries** ([mobbin](https://mobbin.com/screens/e7cf83db-617f-4448-8164-193fec3f255b))
- A view builder seeded with **"Suggested Queries"** (Prioritized, Assigned to Me, For Review,
  Recent Errors) each shown as a readable query string. Brilliant onboarding: a new lawyer gets
  useful pre-built segments instead of a blank filter box.

**HubSpot — Help Desk with saved-view left rail** ([mobbin](https://mobbin.com/screens/6228df0a-7927-4862-b9be-c792cf7a19e8))
- Left rail of saved views with **live counts** (Unassigned 0, Assigned To Me 1, All Open 1, My
  Mentions, All Closed) plus a "Create view" affordance and an "Edit columns" button on the table.
  Counts-per-view is the at-a-glance caseload gauge Legal Owl is missing.

**Asana — quick filters popover** ([mobbin](https://mobbin.com/screens/431c1864-d7da-411a-9744-29f79ea8f18e))
- A filter popover with one-tap **Quick filters** (Incomplete tasks, Just my tasks, Due this week,
  Due next week) above full custom filters, and a "Save view" button. "Due this week" maps perfectly
  to "Hearings this week" for a lawyer.

### Pattern D — Filtering ergonomics

**Relevance AI — structured filter builder** ([mobbin](https://mobbin.com/screens/7690aff3-4875-4930-9b99-52e52a7f0b07) · [is/is-not](https://mobbin.com/screens/e56da5a0-b535-48e6-8901-19ae223f5d18))
- Filter panel where you pick a field (Status / Last updated / Date created), an operator (Is / Is
  not), then values, with **a filter count badge ("Filter 2")** and Clear/Apply. Shows how to offer
  expressive filtering (status is-not Disposed) without overwhelming the default view.

**Square — slide-over "Filter by" panel** ([mobbin](https://mobbin.com/screens/174e55d3-7a40-4394-a7e7-071d29341f41))
- Inline filter chips in the toolbar (Category, **Status: Active**, All filters) that open a
  right-side drawer summarizing each filter's current value ("Status — Active", "Inventory — All").
  The toolbar-chips-summarize-state pattern keeps the active filter set visible at all times.

---

## Gaps vs. best-in-class

| Gap | Legal Owl today | Best-in-class reference |
|---|---|---|
| Status not visible per row | only filterable | Linear groups by status; Salesforce/Zoho show a Status column; ClickUp inline status |
| CNR/identifier hidden | searchable only | Salesforce "Case Number" + Linear monospace id as first column |
| No sort control | fixed sort | Attio/Salesforce/Zoho per-column sort carets + header menu |
| No additional columns / column chooser | 2-line fixed row | Attio add-column picker; HubSpot "Edit columns"; Jira columns |
| No counts (per filter or total) | none | HubSpot view counts; Zoho "Total Records" + pager; Linear group counts |
| No saved/custom views | 5 hard-coded tabs | Linear Views, Sentry suggested queries, HubSpot saved views |
| No grouping | flat list | Linear group-by-status; "Due this week" buckets (Asana) |
| No bulk actions / multi-select | none | ClickUp floating action bar; Zoho/Salesforce checkboxes |
| No inline row actions | open matter for everything | ClickUp inline status; Attio header menu |
| Weak hearing-date escalation | plain pill | Zoho colored date chips (Today/red overdue) |
| Composable filters | binary pills only | Linear filter chips; Relevance/Square filter builder |
| Density / pagination | fixed generous rows, no limit | Attio density; Zoho pager |

---

## Recommendations

Prioritized; each notes impact / effort and the inspiration it draws from.

1. **Add a status badge to every row.** Render `StatusBadge` (existing convention) inline on row line
   2 next to the forum/court chip, and escalate the `HearingPill` when the hearing is today/overdue
   (red) vs this week (amber) vs later (muted). A litigator must see *status + urgency* without
   clicking. **Impact: high · Effort: S.** (Linear status glyphs; Zoho colored date chips.)

2. **Surface CNR + a "last activity" hint on the row.** Show the CNR (monospace, copyable) beneath
   or beside the `key`, and add a faint "updated 3d ago" / "next hearing" relative time. CNR is the
   only bridge to eCourts; it must be visible and copyable. **Impact: high · Effort: S.**
   (Salesforce Case Number column.)

3. **Show counts on the filter pills + a total.** Render `Active 12 · On hold 3 · Disposed 40` and a
   "N matters" total above the list (one grouped count query). Lets a lawyer gauge caseload instantly
   and decide where to look. **Impact: high · Effort: S–M.** (HubSpot view counts, Zoho total
   records, Linear group counts.)

4. **Group the default view by hearing window.** When sorted by hearing, bucket rows under
   **Overdue / Today / This week / Next 30 days / No date** section headers with counts. This turns
   the list into a triage queue that matches how lawyers plan their week. **Impact: high · Effort:
   M.** (Linear grouped sections; Asana "Due this week".)

5. **Replace binary pills with composable filter chips + a sort control.** Keep status as quick
   chips, but add removable filter chips (Court is HC, Client is X, Hearing this week) with a `+ Add
   filter` and a `Sort by` menu (Next hearing / Recently updated / Client A–Z / Status). Solo lawyers
   slice their docket many ways; one fixed sort is limiting. **Impact: high · Effort: M–L.** (Linear
   filter chips; Relevance/Square filter builder; Attio/Salesforce sort.)

6. **Introduce saved views (with seeded defaults).** Let lawyers save a filter+sort+grouping combo
   as a named view ("HC hearings this week", "Awaiting filing", "My disposed FY24"), shown in a
   switcher with counts. Seed 3–4 useful defaults so new users aren't staring at a blank filter box.
   **Impact: high · Effort: L.** (Linear Views, Sentry suggested queries, HubSpot saved views.)

7. **Add an optional dense "table" view with a column chooser.** Offer a list/table toggle; table
   mode shows sortable columns (Matter, Status, Court, Client, CNR, Next hearing, Updated) with an
   add/hide-column menu and a per-column sort. Power users with large dockets need density + scanning
   across attributes. **Impact: med · Effort: L.** (Attio table + add-column; Jira/Zoho columns.)

8. **Multi-select + bulk actions.** Row checkboxes (appear on hover/long-press) and a floating bottom
   action bar (Change status · Archive · Assign client · Export). Managing 50 matters one-by-one is
   painful; bulk archive/status is the highest-value batch op. **Impact: med · Effort: M–L.**
   (ClickUp action bar; Zoho/Salesforce checkboxes.)

9. **Per-row quick actions (kebab) + inline status change.** A trailing `…` menu (Change status,
   Add hearing, Add task, Archive, Copy CNR) so common edits don't require opening the matter.
   **Impact: med · Effort: M.** (ClickUp inline status; Attio header menu.)

10. **Live (debounced) search with scope + recent searches.** Make the search box filter as you type
    (debounced server action or client filter), and let it scope to CNR vs title. Lawyers often
    paste a CNR; instant feedback beats a full reload. **Impact: med · Effort: M.**

11. **Add pagination / virtualization + a density toggle.** Cap the initial query (e.g. 50) with a
    pager or infinite scroll, and offer comfortable/compact row density. Protects firms with large
    dockets and speeds scanning. **Impact: med · Effort: M.** (Zoho pager; Attio density.)

---

## Quick wins

1. **Inline `StatusBadge` on each row** — the single biggest scannability gain; component already
   exists. (Rec 1)
2. **Escalate the `HearingPill`** to red for today/overdue and amber for this-week in
   `components/badges.tsx`. (Rec 1)
3. **Show CNR (monospace, copyable) on the row** beside the `key`. (Rec 2)
4. **Counts on the filter pills + a "N matters" total** via one grouped count query. (Rec 3)
5. **Add a simple `Sort by` dropdown** (Next hearing / Recently updated / Client A–Z) wired to the
   existing `?sort=` searchParam — small change to the query at `page.tsx:40-41`. (Rec 5)
