# Matter detail (case file) — UX benchmark

Surface owner: Matter detail (the single case-file page) + the "new matter" creation flow.
Platform benchmarked: web. Dark theme is treated as a fixed constraint — we benchmark execution,
not the palette choice.

---

## Current state (Legal Owl)

### What exists today

The matter detail page (`apps/web/app/(app)/matters/[id]/page.tsx`) is a single, narrow,
center-column layout (`max-w-3xl`, `page.tsx:116`). Top to bottom:

1. **Back link** to `/matters` (`page.tsx:117-119`).
2. **Pinned case header card** (`page.tsx:122-167`): serif title; parties line rendered as
   `petitioners v. respondents` (`page.tsx:126-132`); a meta row with `ForumBadge`, case type,
   `CNRChip`, and a link to the client/engagement (`page.tsx:146-156`); a footer row with
   "Next hearing" `HearingPill` on the left and a `MatterStatusControl` on the right
   (`page.tsx:158-166`). An `EditDetailsDialog` (pencil) sits top-right (`page.tsx:134-143`).
3. **A 5-tab strip** — Timeline / Tasks / Hearings / Deadlines / Documents (`page.tsx:169-176`).
   Tasks shows an open-count number (`page.tsx:172`).
4. **Timeline tab** (`page.tsx:179-205`): an inline "Add a remark…" textarea + Add button at top,
   then a merged, reverse-chronological list of `court_events` and `remarks`. Server merges the two
   sources into one `TL[]` and sorts desc (`page.tsx:93-110`). Remarks render as bordered cards;
   events render as flat one-liners. Each carries a `SourceChip` (ecourt / lawyer_manual / system)
   and a date.
5. **Tasks tab** (`page.tsx:208-210`) → `TaskList` client island (`components/matter/task-list.tsx`):
   a bordered list with a complete toggle, truncated title, optional `DueDateBadge`, and two inline
   `<select>`s for priority and workflow state, plus an inline "Add a task…" composer at the bottom.
6. **Hearings tab** (`page.tsx:213-252`): add-hearing form (date + purpose), then a list of hearing
   cards; scheduled hearings get an inline "record outcome" form (held/adjourned + outcome text).
7. **Deadlines tab** (`page.tsx:255-282`): add-deadline form (date, type, basis), then a divided
   list with a type chip + basis + due date. Good empty-state copy: "Statutory and limitation dates
   are computed by rule, never guessed." (`page.tsx:268`).
8. **Documents tab** (`page.tsx:285-325`): a file input + source select + Upload; then a divided
   list; each row downloads via a signed URL (`actions.ts:220-227`) and has a trash delete.

Server actions (`[id]/actions.ts`) are clean: `addRemark`, `addHearing`/`setHearingOutcome` with a
`recomputeNextHearing` projection (`actions.ts:16-34`), `addDeadline`, `uploadDocument` (Storage at
`${user.id}/${matterId}/...`), task CRUD, and `setMatterStatus`/`archiveMatter`.

The **new matter** flow (`matters/new/page.tsx`) is a single `max-w-xl` form: title, client select,
forum + case type, petitioners/respondents textareas (one-per-line), CNR (mono), first hearing date,
and a full-width Create button. `createMatter` (`new/actions.ts`) auto-creates the General
engagement, inserts the matter, and seeds a "First hearing" hearing row if a date was given.

### Strengths

- **Domain-correct and honest.** Parties as `v.`, CNR as a monospace chip, forum badges, the
  "computed by rule, never guessed" deadline copy — this reads like software built by someone who
  understands Indian litigation, not a generic CRM.
- **The merged timeline is the right core idea.** Court events + lawyer remarks in one stream is
  exactly the differentiator (grounding in real case data). The `SourceChip` provenance is a strong,
  trust-building touch.
- **Inline composers everywhere** (remark, task, hearing, deadline, document) keep the lawyer in
  flow — no modal round-trips for the common case.
- **Next-hearing as a derived projection** (not a free-text field) is correct and avoids drift.
- Clean Server Action architecture; status/archive controls live in the header where they belong.

### Concrete weaknesses

1. **No at-a-glance "command panel."** The most time-sensitive facts a lawyer needs in 2 seconds —
   next hearing (with countdown), nearest deadline, open-task count, last court update, matter id
   `M-…` and CNR — are scattered across the header and buried inside tabs. There is no persistent
   side panel of properties (cf. Linear/Attio/Salesforce all have one).
2. **Single narrow column wastes desktop width.** `max-w-3xl` centered means a 27" screen shows one
   skinny column. Best-in-class record pages are 2- or 3-pane (main stream + properties rail).
3. **Everything-behind-tabs hides parallel context.** To see if there's an upcoming deadline while
   reading the timeline, you must leave the timeline. Hearings, deadlines, and tasks are exactly the
   things you want *peripherally visible*, not one click away each.
4. **The matter id (`M-…`) is fetched but never shown.** `key` is selected (`page.tsx:67`) but not
   rendered. Lawyers refer to internal file numbers constantly; it should be copyable near the title.
5. **Timeline events are visually flat and un-grouped.** No date dividers ("Today / This week"),
   no per-event-type icons, no connecting rail. Court orders, status changes, and remarks all look
   alike. Compare Airbnb/Vercel/Todoist activity feeds which group by date and ice each row with an
   icon.
6. **Documents can't be previewed or grouped.** Download forces a signed-URL redirect/navigation
   (`actions.ts:225-226`); no inline PDF preview, no grouping by type (order / judgement / filing),
   no file-size/type metadata shown though it's stored (`actions.ts:213-214`). No drag-and-drop.
7. **No document → timeline link.** Uploading a court order should drop an entry on the timeline;
   today there is an `order_uploaded` event *type* defined (`page.tsx:33`) but `uploadDocument`
   never writes a `court_events` row, so the file and the activity stream are disconnected.
8. **Destructive + no confirmation, no undo.** Document delete is a bare trash button
   (`page.tsx:317-319`) with no confirm; a misclick permanently removes a court order.
9. **New-matter form is flat and unsegmented.** Eight fields with no section grouping, no inline
   CNR validation/format hint beyond a placeholder, no "create another," and no way to fetch case
   metadata from a CNR (the obvious eCourts integration hook). Parties-as-textarea (one-per-line) is
   unforgiving.
10. **No AI affordance on the file** despite that being the product's core bet. There is no
    "ask this matter" entry point, no auto-summary of the case, no "summarize this order" on a
    document — the grounding surface exists (timeline + docs) but is not yet exploited.
11. **Empty header when parties are absent** and **no header status/urgency color** — a matter
    whose next hearing is tomorrow looks identical to one with no hearing.

---

## Inspiration gallery

### Pattern A — Two/three-pane record detail (main stream + properties rail)

**Attio — record detail** ([mobbin](https://mobbin.com/screens/297adfeb-8312-496b-8acf-41839a6cf775))
- Center is a clean **Activity stream that groups changes** ("Alex changed Stage and 7 other
  attributes") with a collapse/expand — multiple field edits collapse into one line, so the feed
  stays scannable instead of one-row-per-change noise.
- Right rail = **Record Details** (Domains, Name, Description, Team, Categories) *and* **Lists** the
  record belongs to — durable metadata always visible while you read history.
- Tabs (Activity / Emails / Team / Notes / Tasks / Files) sit above the stream, but the
  properties rail persists across tabs. This is the model Legal Owl should copy: persistent
  case facts on the right, switchable stream on the left.

**Linear — issue detail** ([mobbin](https://mobbin.com/screens/95830cca-2494-4f09-ae16-a9674071d109))
- The gold standard for a **right-hand Properties rail**: Status, Priority, Assignee, Labels,
  Project, Milestone, Due Date — each a single-click inline editor with an icon + value. Nothing is
  buried; everything mutable is one tap.
- Activity + threaded comments run down the center; system events ("changed status from In Progress
  to Todo", "added label") are **dimmed, icon-led, single lines**, while human comments are full
  cards. Exactly the event-vs-remark distinction Legal Owl needs but renders too flatly today.
- Sub-issues render inline with their own status/estimate
  ([mobbin](https://mobbin.com/screens/f00cc4fb-4083-43fc-a0fb-703a6c4ef771)) — a model for showing
  related tasks *inside* the file without a tab hop.

**Salesforce — lead/record detail (3-pane)**
([mobbin](https://mobbin.com/screens/8d1be4c5-4792-4c88-967b-b3393beadb8f))
- Three columns: **About/Details** (editable fields with pencils) on the left, a center
  **Activity timeline split into "Upcoming & Overdue" vs "This Month"**, and a contextual right
  panel (Slack channel / related). The "Upcoming & Overdue" grouping is a brilliant pattern for a
  lawyer: surface the next hearing/deadline at the top of the stream, not just past events.
- Activity composer is a tabbed bar (log a call / email / task) docked above the feed.

**Pipedrive — organization detail**
([mobbin](https://mobbin.com/screens/8dc57953-8b9b-4221-b6c7-8c91d648dd2d))
- Left **Summary/Details** rail with inline "Add label", "Add address or enrich data" and an
  **open-deals widget with progress bars**. The right side has a **Focus** card (the single most
  important overdue item, pinned above the full History) — directly analogous to pinning the next
  hearing/nearest deadline above the timeline.
- History has sub-filters (All / Activities / Notes / Emails / Files / Changelog) so one stream can
  be sliced without leaving the page.

**Lightfield — account detail** ([mobbin](https://mobbin.com/screens/edb25210-fb3c-4cd4-8736-85569882b93e))
- Minimal dark-leaning layout: center "Open tasks / Activity", right rail of **Account details**
  with "See more" progressive disclosure, plus **Opportunities / Contacts / Meetings / Tasks / Notes
  each as a compact section with a "See all"** link. A good template for cramming many related
  collections (hearings, deadlines, docs, tasks) into one scroll with sane truncation.

### Pattern B — Activity timeline craft

**Salesforce — Upcoming & Overdue split** (same screen as above) — the single most transferable
idea: a timeline that leads with *future* obligations, then past history.

**Airbnb — All activity** ([mobbin](https://mobbin.com/screens/d4d97280-b2f8-41e0-8671-66fa030ad6c9))
- **Date dividers ("19 JUN 2023")**, a left timeline rail with dots, two-line rows (context line +
  bold event title + "By Jane Smith"), right-aligned timestamps, and **filter chips (Dates /
  Listings / Users)** at the top. This is precisely the structure to upgrade Legal Owl's flat
  `<ol>` into: dotted rail, date groups, event-type filters (Court / Remarks / Documents / Status).

**Vercel — Activity** ([mobbin](https://mobbin.com/screens/e6f12935-765d-40eb-b418-87195bbfe0ec))
- **Per-event-type icons**, nested/grouped sub-events under a parent ("You / project → 3 deploys"),
  a left **Type filter with checkboxes and human descriptions** of each event type, and a
  "Load More" pager. The icon-per-type and grouped-children patterns fix Legal Owl's "everything
  looks the same" problem and the changelog-noise problem at once.

**Todoist — activity** ([mobbin](https://mobbin.com/screens/227f7420-0530-4b35-a18f-2e2f1de9bf4a))
- Date headers ("14 Sep · Today · Wednesday"), a person filter + an event-type filter ("Completed
  tasks"), and a "Load more history from 3 weeks ago" affordance — lightweight, fast, scannable.

### Pattern C — Documents inside a record

**Origin — Estate Planning › Documents**
([mobbin](https://mobbin.com/screens/d52a81bd-1009-4ca3-852b-175a33d8c772))
- Documents **grouped by category** ("Estate Plan Documents" vs "Supporting Documents"), each row
  with a file icon, name, a **status pill (Not signed / Signed / File Uploaded)**, a per-row
  **⋯ menu** (Upload signed copy / Download original / Mark as signed), and a **"Download all"**
  button. The grouping + status-pill + row-menu pattern maps perfectly onto Legal Owl's
  order/judgement/filing document types and would replace the bare trash icon with a safe menu.
- Upload is a clean modal dropzone with a max-size hint
  ([mobbin](https://mobbin.com/screens/4eb3e41d-6d8e-4ee5-a326-84a3416cab39)).

**Gusto — Add document modal** ([mobbin](https://mobbin.com/screens/1bc77eb7-47f6-41ef-abbd-3bba54098926))
- Tight "Add document" modal: a **Name field with helper copy** ("Give your document a short, 2-3
  word description"), an **Upload / or drop file** zone, the selected filename chip with an ✕, and
  Cancel/Save. A model for letting lawyers *name* a filing meaningfully instead of inheriting a raw
  filename.

**Square — project detail with Documents tab**
([mobbin](https://mobbin.com/screens/f08ff5c8-38a0-486e-9a25-ee80ab107528))
- Documents grouped into Invoices / Contracts / Attachments with status (Draft / Emailed) and a
  right-hand **Project overview + Notes + Activity** rail — the same main-list + context-rail shape.

**HoneyBook — project file** ([mobbin](https://mobbin.com/screens/79c824af-4572-4f24-846a-44c26135556a))
- A pinned "Active smart files" card with a **per-file action checklist + progress ring**, plus a
  right rail of Stage / Lead source / Tags / Scheduled sessions / Time tracker. Shows how to make a
  document feel like a *live workflow object*, not a dead attachment.

### Pattern D — Creating a new record (multi-field / segmented form)

**Jobber — Create client** ([mobbin](https://mobbin.com/screens/3c364dd3-519d-4899-803d-c546b3a081c1)),
flow ([mobbin](https://mobbin.com/flows/5df8aca8-7c25-4a21-a471-ac15ca262996))
- **Sectioned single-page form**: "Primary contact details", "Property address", with each section
  carrying a left-side label + helper description and the inputs on the right (a clear two-column
  rhythm). **Collapsed "Additional details / Additional contacts" accordions** keep the common path
  short while allowing depth. Footer has **Cancel / Save and Create Another / Save** — the
  "Create Another" is exactly what a lawyer onboarding 20 files at once needs.

**Remote — Add an employee (stepper)**
([mobbin](https://mobbin.com/screens/5340235d-3331-49c2-8d62-173f69d97bfd))
- A **left vertical stepper** (Employment eligibility → Basic information → Contract details →
  Pricing plan) with a progress %; each field has **helper text under it** and a contextual
  "Good to know" side panel (e.g. weekend/public-holiday warnings on a date picker). Great model if
  matter creation grows (it's already 8 fields and will gain CNR-fetch + deadline seeding).

**Deel — Add new entity (auto-save + review step)**
([mobbin](https://mobbin.com/screens/9d3717c8-e75d-4504-9e4c-24611b91b63b))
- Sectioned cards (Entity / Contact / Identification details) with **"Auto-save: this form is
  automatically saved"** and a final **"Step 5: Review Information"** summary with a checklist of
  completed sections. Reassuring for data-heavy entry.

**HubSpot — multi-step form builder** ([mobbin](https://mobbin.com/flows/48385aac-bce2-4aa3-9aec-dd663fe3612e))
- Field-level "Connected property" concept — each form field maps to a CRM property. Conceptually
  reinforces that matter-creation fields should be first-class, typed properties (forum, case type,
  CNR) rather than loose inputs.

---

## Gaps vs. best-in-class

| # | Gap in Legal Owl | Best-in-class reference |
|---|---|---|
| 1 | No persistent properties/facts rail; key facts buried in header + tabs | Linear, Attio, Salesforce, Pipedrive all have a persistent right rail |
| 2 | Single narrow column; desktop width unused | Salesforce/Pipedrive/Attio 2–3 pane |
| 3 | Timeline leads with past; future obligations not surfaced at top | Salesforce "Upcoming & Overdue", Pipedrive "Focus" card |
| 4 | Flat, un-grouped, icon-less timeline | Airbnb date dividers + rail; Vercel icons + grouped children; Todoist date headers |
| 5 | No timeline filters/segments | Pipedrive History sub-tabs, Vercel/Todoist type filters |
| 6 | Documents not grouped, no status, no preview, bare trash delete | Origin grouped docs + status pills + ⋯ menu + Download all |
| 7 | Document upload disconnected from timeline; no meaningful naming | Gusto add-document (named); HoneyBook live file objects |
| 8 | Matter id `M-…` never displayed/copyable | Linear/Attio/Pipedrive show record id prominently |
| 9 | New-matter form flat, no sections, no "create another", no CNR fetch | Jobber sectioned + "Save and Create Another"; Remote stepper; Deel review step |
| 10 | No AI/ask-the-matter affordance despite being the core product bet | (product differentiator — no direct comp, but the grounding data exists) |
| 11 | No urgency/status signal on the header | Salesforce overdue flags, Pipedrive Focus |

---

## Recommendations

Ordered by leverage for a busy solo litigator.

1. **Add a persistent right-hand "Case facts" rail (2-pane layout).** Widen to `max-w-6xl` and split
   into a main column (timeline/tabs) + a sticky right rail showing, top to bottom: Matter id
   `M-…` (copyable) + CNR (copyable mono), Status (the existing `MatterStatusControl`), **Next
   hearing with a live countdown** ("in 3 days"), **Nearest deadline** with type chip, Open tasks
   count, Forum + case type, Client/engagement link, and "Created / Last court update" stamps. Each
   row click-to-edit where it makes sense.
   *Why:* the lawyer sees the only five things that matter without scrolling or tab-hopping.
   *Impact: high · Effort: M · Draws from: Linear, Attio, Salesforce, Pipedrive.*

2. **Lead the timeline with "Upcoming & Overdue," then history.** Above the merged stream, render a
   compact section of future hearings + open deadlines (sorted ascending, overdue in `--urgent`),
   then the reverse-chron past stream. This reuses data already fetched.
   *Why:* litigation is run forward from the next date; the page should match that mental model.
   *Impact: high · Effort: M · Draws from: Salesforce "Upcoming & Overdue", Pipedrive "Focus".*

3. **Upgrade the timeline visually: date dividers + a dotted rail + per-type icons + grouping.**
   Group `TL[]` by day with "Today / Yesterday / dd-MMM" headers, add a left rail with a dot per
   row, give each event type an icon (gavel = hearing change, file = order uploaded, flag = status,
   pencil = remark), and collapse runs of system changes ("Status changed 3 times") into one
   expandable line.
   *Why:* a 40-event case file becomes scannable in seconds; provenance stays clear.
   *Impact: high · Effort: M · Draws from: Airbnb, Vercel, Todoist, Attio.*

4. **Add timeline filter chips.** Court updates / Remarks / Documents / Status — toggleable at the
   top of the stream (client-side filter over the already-merged list).
   *Why:* "show me only court orders" is a constant need before a hearing.
   *Impact: med · Effort: S · Draws from: Pipedrive History sub-tabs, Vercel/Todoist filters.*

5. **Write a `court_events` row on document upload and key mutations.** When a court order/judgement
   is uploaded, insert an `order_uploaded` event so it appears in the timeline (with a link to the
   file). Same for status changes if not already evented.
   *Why:* closes the doc↔activity gap; the timeline becomes a true case history.
   *Impact: high · Effort: S · Draws from: HoneyBook live file objects; the `EVENT_LABELS` map already anticipates this (`page.tsx:33`).*

6. **Rebuild the Documents tab: group by type, add status, ⋯ menu, inline preview, Download all,
   drag-drop.** Group rows under "Court orders / Judgements / Filings & uploads", show size + date,
   replace the bare trash with a ⋯ menu (Open / Download / Rename / Delete-with-confirm), open PDFs
   in a side preview pane or new tab instead of a forced redirect, and add a dropzone over the list.
   *Why:* the case file is, to a lawyer, mostly its documents; this is where the product earns trust.
   *Impact: high · Effort: L · Draws from: Origin, Gusto, Square.*

7. **Surface and copy the matter id + CNR near the title.** Render `key` (`M-…`) as a copyable mono
   chip beside the title, alongside the CNR chip.
   *Why:* lawyers cite internal file numbers and CNRs verbally and in filings constantly.
   *Impact: med · Effort: S · Draws from: Linear/Attio/Pipedrive record ids.*

8. **Add an "Ask this matter" AI entry point.** A docked button/field ("Ask about this case…") in
   the header or rail that opens a grounded chat over this matter's timeline + documents, plus a
   one-line auto-summary card at the top of the file and a "Summarize this order" action on document
   rows.
   *Why:* this is the product's core differentiator (grounded AI); the matter page is where the
   grounding data lives, so it is the natural home.
   *Impact: high · Effort: L · Draws from: product strategy (grounding in real case data).*

9. **Section the new-matter form and add "Create another."** Group into "Case identity" (title,
   client, forum, case type), "Parties" (petitioners/respondents), "Court reference" (CNR + first
   hearing), each with a left label + helper. Footer: Cancel / Save and create another / Create.
   Add a CNR format hint and inline validation.
   *Why:* lawyers onboard files in batches; sectioning + "create another" cuts repeated context loss.
   *Impact: med · Effort: M · Draws from: Jobber, Remote, Deel.*

10. **CNR-driven autofill on new matter (eCourts hook).** When a valid CNR is entered, offer
    "Fetch case details" to pre-fill parties/forum/case-type/next-hearing from eCourts.
    *Why:* eliminates the highest-friction part of onboarding and is the headline integration in the
    strategy (court monitoring lands in case management).
    *Impact: high · Effort: L · Draws from: HubSpot connected-property concept; product strategy.*

11. **Header urgency signal + status color.** When the next hearing is within N days or a deadline is
    overdue, tint the header/rail (use the existing `--urgent`) and show "Tomorrow"/"Overdue".
    *Why:* the most urgent files should *look* urgent at a glance.
    *Impact: med · Effort: S · Draws from: Salesforce overdue, Pipedrive Focus.*

12. **Confirm destructive actions + add undo.** Wrap document delete (and matter archive) in a
    confirm dialog or an undoable toast.
    *Why:* a deleted court order with no confirm is a real malpractice-grade risk.
    *Impact: med · Effort: S · Draws from: Origin's safe ⋯ menu.*

---

## Quick wins

1. **Show the matter id `M-…` (and make CNR copyable) by the title** — data is already fetched
   (`page.tsx:67`); pure render. (Rec 7)
2. **Insert a `court_events` row in `uploadDocument`** so uploads hit the timeline — a few lines in
   `actions.ts`, and `EVENT_LABELS.order_uploaded` already exists. (Rec 5)
3. **Add a confirm to the document delete trash button** — swap the bare `<button>` for an
   AlertDialog. (Rec 12)
4. **Add date dividers + per-type icons to the existing timeline `<ol>`** — no schema change, just
   grouping the already-built `TL[]` and a small icon map. (Rec 3, partial)
5. **Add "Save and create another" to the new-matter form** and a CNR format hint — small form +
   action tweak that pays off during onboarding. (Rec 9, partial)
