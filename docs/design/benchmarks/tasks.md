# Tasks — UX benchmark

Surface: **Tasks** (Actions across matters). The cross-matter list/board of work — to-do
items with workflow_states (To-Do, Awaiting Filing, …), due dates, priority, and a linked
matter. Dark off-dark mint/lemon theme is a fixed constraint; we benchmark execution, not
the choice of dark.

---

## Current state (Legal Owl)

### What exists today

- **Page** — `apps/web/app/(app)/tasks/page.tsx`. Server Component. Fetches all `actions`
  joined to `workflow_states` and `matters`, ordered by `due_date` ascending
  (`page.tsx:24-30`). Filters client-side into four buckets via a `filter` searchParam:
  Open / Overdue / Done / All (`page.tsx:8-13`, `35-39`).
- **Filter chips** — pill-style links across the top; the active chip gets a primary border +
  tint (`page.tsx:52-68`). Filtering is a full navigation (a `<Link>` per chip), not client
  state.
- **List rows** — `components/tasks-list.tsx`. Each row is a flat `<li>`: a complete/incomplete
  toggle (Circle / CircleCheck, `tasks-list.tsx:39-51`), title + linked matter subtitle
  (`tasks-list.tsx:52-64`), an optional `DueDateBadge` (`tasks-list.tsx:65`), and two inline
  `<select>` dropdowns for Priority and Status (`tasks-list.tsx:66-91`). Mutations fire through
  `useTransition` against server actions imported from the matter route
  (`tasks-list.tsx:8-12`).
- **Empty state** — single `EmptyState` with a context-aware title ("Nothing overdue" vs "No
  tasks here") and a static hint (`page.tsx:70-74`).
- **Width** — capped at `max-w-3xl` (`page.tsx:49`), a single narrow column.

### Strengths

- **Inline edits without leaving the list.** Toggle complete, change priority, change status —
  all optimistic via `useTransition`. This is the right instinct and matches Linear/ClickUp.
- **Matter context on every row.** The matter title is a deep link (`tasks-list.tsx:56-63`) —
  good for a lawyer who thinks "which case is this for?"
- **Overdue is a first-class filter**, computed against today (`page.tsx:38-39`). Lawyers live
  and die by deadlines, so surfacing overdue is correct.
- **Clean, legible single-column list** — low cognitive load.

### Concrete weaknesses

1. **No grouping.** Everything is one flat chronological list. There is no "group by status",
   "group by due date (Overdue / Today / This week / Later)", or "group by matter". Every
   best-in-class task app groups by default (ClickUp, Linear, Todoist all do). A flat list of
   30 actions across 12 matters is a wall.
2. **No board / kanban view.** workflow_states (To-Do → Awaiting Filing → …) is literally a
   pipeline, but there is no column view to see WIP per stage. The data model is begging for a
   board; the UI never offers one.
3. **No "create task" entry point on this surface.** You can only create actions from inside a
   matter (the empty-state hint admits this, `page.tsx:73`). A lawyer who thinks "I need to
   draft a reply by Friday" cannot capture it here. Todoist/Height/Asana all have a persistent
   "Add task" affordance + quick-add.
4. **Status/priority as raw `<select>` boxes.** Two native dropdowns per row
   (`tasks-list.tsx:66-91`) are visually noisy, hard to scan, and don't communicate priority/
   status through color the way a badge does. Compare ClickUp's colored status pills and
   Todoist's priority flags.
5. **No priority signal at a glance.** Priority is hidden inside a dropdown; you can't scan the
   list for "what's P1?" There's no sort-by-priority and no visual weight (color bar / flag).
6. **No due-date intelligence.** `DueDateBadge` shows a date, but the list isn't segmented by
   urgency and there is no "Today" / "Overdue" header section, no reschedule action, no count
   of how many are overdue. Todoist's "Overdue" section + one-tap "Reschedule" is the gold
   standard.
7. **No counts / no density of information.** Filter chips don't show counts (e.g. "Overdue 4").
   Lawyers want to know the size of the problem before clicking.
8. **No search / no per-matter or per-client filter.** Once you have >20 actions you can't
   narrow to one client or text-search a title.
9. **Sort is fixed** (due_date asc, nulls last). No sort control. Tasks with no due date sink
   to the bottom invisibly.
10. **No bulk actions, no keyboard.** Can't multi-select to reschedule/complete; no `c` to
    create, no command-K. Linear sets the bar here.
11. **Narrow `max-w-3xl`** wastes a desktop lawyer's screen; a board or multi-column grouped
    list wants more horizontal room.

---

## Inspiration gallery

### Pattern A — List grouped by status (the default everyone ships)

**ClickUp — List view, grouped by status**
[mobbin.com/screens/6d6f66d8…](https://mobbin.com/screens/6d6f66d8-b70a-42a7-8513-6604418cc664) ·
[second example](https://mobbin.com/screens/107b20a9-269a-4509-83fd-040416f3fb90) ·
[dark variant](https://mobbin.com/screens/8b2419a3-f16a-4a36-8269-871829c24f8c)
- Tasks are bucketed under **colored status group headers** (TO DO, IN PROGRESS, ON HOLD,
  COMPLETE) each with a **count** and a collapse caret. You instantly see how much work sits in
  each stage — exactly what Legal Owl's flat list hides.
- Each group is a **mini-table with aligned columns**: Assignee, Due date, Priority (flag),
  Finalized. Aligned columns make 20 rows scannable; Legal Owl's inline selects don't align.
- A persistent **"+ New task" / "+ Add task"** sits in every group header and at the bottom of
  each group — capture is always one click, scoped to the right status.
- The dark variant proves a status-grouped colored-pill list reads well on a dark canvas — the
  status color does the heavy lifting, the rest is muted. Directly relevant to our theme
  constraint.

**ClickUp — grouped list with priority flags + due dates**
[mobbin.com/screens/e90207ad…](https://mobbin.com/screens/e90207ad-ffba-4b65-9148-eb7e204d2623)
- Priority is a **colored flag glyph**, not a dropdown — red/orange/blue scannable in one pass.
  Overdue dates render in **red/amber inline**, due-today in a distinct color. Urgency is
  encoded in color, not buried.

### Pattern B — Kanban board over the same statuses

**Linear — issues board, status columns**
[mobbin.com/screens/514488cf…](https://mobbin.com/screens/514488cf-f8e2-4d96-b61a-2a03bc7c7629) ·
[dark board](https://mobbin.com/screens/a6f3c2e2-cbe0-4559-bda7-54ee9d405692) ·
[dark, two columns](https://mobbin.com/screens/29621c0a-9946-46aa-9d39-6d5f4f578b21)
- Columns = workflow states (Backlog, Todo, In Progress, Done) each with a **status icon +
  count** in the header. The whole pipeline is visible at once — the single most natural fit for
  Legal Owl's `workflow_states` chain.
- Cards are **calm and minimal**: id, title, a small priority bar-chart glyph, optional due
  date + label chip, assignee avatar. Almost no chrome. Cards stay readable on the dark theme
  because everything non-essential is greyed.
- The List/Board view toggle lives top-right (the two-pane icon) — the SAME data, two lenses,
  one click apart. Legal Owl has only the list.

**Linear — board with right-hand properties rail**
[mobbin.com/screens/52e2f6c6…](https://mobbin.com/screens/52e2f6c6-9192-4ab8-a344-cb93c1f5e2ef)
- Board plus a docked properties panel (Status, Priority, Lead, Dates, Milestones, Progress) —
  shows how board + detail can coexist. Useful when we add a task detail panel.

### Pattern C — "My day": grouped by date, Overdue first

**Todoist — Today view (Overdue + dated sections)**
[mobbin.com/screens/c5a963dd…](https://mobbin.com/screens/c5a963dd-7247-490a-b403-61d5525ee2a4) ·
[another Today](https://mobbin.com/screens/f3d5ee5e-bfb1-4b7e-8b21-e5833f3025da)
- A bold **"Overdue" section header with a "Reschedule" action right next to it** — surfaces the
  scary stuff first and gives a one-click escape hatch. For a lawyer with three blown deadlines,
  this is the killer feature Legal Owl lacks.
- Below, tasks group under **date headers** ("26 Aug · Today · Monday"). Date is structure, not
  a per-row badge — far more scannable than Legal Owl's date-on-each-row.
- Each row shows the **project/section breadcrumb on the right** (e.g. "Design Sprint /
  Pre-sprint prep") — our equivalent is matter/client, which we already link but could right-
  align for cleaner scanning.
- A circular checkbox whose **ring color encodes priority** — priority + completion in one
  control. Smart density.

**Todoist — Upcoming (calendar-grouped agenda)**
[mobbin.com/screens/4c13dd58…](https://mobbin.com/screens/4c13dd58-bd96-4b77-86f7-5ae2d22643ea)
- A week strip + day-by-day agenda with inline "+ Add task" under each day. Good model for a
  "schedule my week" lens over hearing-prep deadlines.

**Todoist — Display/sort popover**
[mobbin.com/screens/a8b34ad5…](https://mobbin.com/screens/a8b34ad5-5892-42c4-b5fe-665fa98a3e89)
- One compact popover holds **Layout (List/Board/Calendar), Grouping, Sorting, Direction, and
  Filters (Date/Deadline/Priority/Label)**. This is exactly the control Legal Owl needs to
  graduate from four hardcoded chips to flexible grouping/sorting — in a single tidy menu.

### Pattern D — Quick-add and create flows

**Todoist — quick-add modal**
[create flow w/ priority menu](https://mobbin.com/screens/wS3Wg89P) (from "Creating a new task")
- A single modal: type the title, and **inline pills** for Date ("Tomorrow 16:00"), Priority
  (P1–P4 menu with colored flags), Reminder, and project. Natural-language date parsing. Capture
  in seconds without a form. Legal Owl has no capture here at all.

**Height — inline new-task row + quick-create popover**
[creating a new task flow](https://mobbin.com/flows/db860423-264b-4761-a143-1b6172525c66)
- A floating "New task" composer with **attribute chips** (List, Status=To do, Assignee,
  Parent, Priority, Type) you set before hitting "Create task". Fast keyboard-driven capture
  that still captures structured metadata — the model for our "create action with matter +
  status + due + priority" without a full page.

**Asana — create-task panel with inline properties**
[create-task flow](https://mobbin.com/flows/e9894023-9b31-4ca8-a883-8c304403757c)
- The new-task panel exposes **Assignee, Project, Priority, Status, Description** inline before
  save; the freshly created task drops straight into the "My tasks / Upcoming" list. Shows the
  full structured-create-then-land-in-list loop.

**Evernote — create-task dialog (Things-style)**
[mobbin.com/screens/8dad0afa…](https://mobbin.com/screens/8dad0afa-e959-4ded-8603-af97bae37c38)
- Clean labeled rows: Description, Due date (Today / Tomorrow / Custom / Repeat), Reminder,
  Assigned to, Priority (Low/Medium/High **segmented control**), Flag. A good template for a
  legal "Action" create dialog where due date and priority are the two fields that matter most.

### Pattern E — Task detail panel (for when a row needs depth)

**Linear — issue detail with right properties rail**
[mobbin.com/screens/c82a38e5…](https://mobbin.com/screens/c82a38e5-7280-4cee-82c3-2f3547a3b735)
- Right-hand rail: Status, Priority, Assignee, Labels, Due Date — each a one-click editable
  control. Body holds description + sub-issues + activity. The canonical structured-task detail.

**Asana — task detail, list grouped "Do today / Do next week / Do later"**
[mobbin.com/screens/2c0e6d97…](https://mobbin.com/screens/2c0e6d97-1be9-4340-80f2-d8f7a187ea3f)
- Note the **left list is grouped by time horizon** ("Recently assigned", "Do today", "Do next
  week", "Do later") with inline "Add task…" per group — a humane alternative to status grouping
  for a personal work queue. Priority is a small dropdown with colored Low/Medium/High.

**Qatalog — task detail panel with subtasks + activity**
[mobbin.com/screens/ea750733…](https://mobbin.com/screens/ea750733-550c-4a35-860a-043820104ece)
- Right rail: Status, Assignees, Due date, Creator, Estimate, Priority, Blocker, Labels, Repeat.
  Body: Subtasks, Comments, Activity feed. Good reference for adding subtasks + an audit trail to
  an Action (useful when an action like "File written statement" has sub-steps).

---

## Gaps vs. best-in-class

| Gap | Legal Owl today | Best-in-class |
|---|---|---|
| **Grouping** | Flat chronological list (`page.tsx:29`) | ClickUp/Linear group by status; Todoist/Asana by date horizon, each with counts + collapse |
| **Board view** | None | Linear/ClickUp ship a one-click List↔Board toggle over the same statuses |
| **Capture on surface** | None — must open a matter | Todoist/Height/Asana have persistent Add + quick-add modal w/ NL dates |
| **Status/priority display** | Raw `<select>` ×2 per row | Colored status pills + priority flags (ClickUp, Todoist, Linear) |
| **Overdue handling** | A filter only | Todoist's "Overdue" section header + one-click Reschedule |
| **Counts** | Chips have no counts | ClickUp/Linear show count per group/column |
| **Sort/filter control** | Hardcoded 4 chips, fixed sort | Todoist Display popover: Layout + Group + Sort + Filters |
| **Search / scope** | None | Search + filter by project/assignee everywhere |
| **Detail view** | None (rows are terminal) | Linear/Qatalog/Asana detail panels with subtasks + activity |
| **Keyboard / bulk** | None | Linear command-K, multi-select, `c` to create |

---

## Recommendations

Prioritized. Each: what, why for a busy lawyer, impact, effort, inspiration.

1. **Group the list by section with counts and collapse.** Default grouping = **due-date
   horizon**: "Overdue" (red), "Today", "This week", "Later", "No date". Sticky group header with
   a count badge ("Overdue · 4") and a collapse caret. Keep the existing filter chips but let
   grouping carry the structure.
   *Why:* a lawyer's first question every morning is "what's overdue / due today?" — structure
   answers it before they read a single title. **Impact: high · Effort: M.** From Todoist Today +
   ClickUp grouped list.

2. **Replace the two `<select>`s with a colored StatusBadge pill + a priority flag/dot.** Show
   status and priority as scannable colored elements; make them editable via a click-to-open
   menu (Base UI menu) rather than always-visible native selects. Right-align status; put a
   priority flag/colored left-border on the row.
   *Why:* color-coded urgency is parseable at a glance across 30 rows; native selects are noise.
   We already have `StatusBadge` (CLAUDE.md). **Impact: high · Effort: S–M.** From ClickUp pills +
   Todoist priority flags.

3. **Add a List ↔ Board view toggle; build the board over `workflow_states`.** Top-right segmented
   toggle. Board columns = the workflow states (To-Do, Awaiting Filing, …) with count headers;
   drag a card to change `state_id` (reuse `updateTaskState`). Cards: title, matter chip, due
   badge, priority flag.
   *Why:* the workflow is a pipeline; a board shows WIP per stage and where cases are stuck
   (e.g. five matters sitting in "Awaiting Filing"). **Impact: high · Effort: L.** From Linear
   board.

4. **Add quick-create on this surface.** A persistent "Add task" button (top-right) + a "+ Add
   task" affordance under each group, opening a compact composer: title, **matter picker**
   (required), due date, priority. Natural-language date if cheap. Land the new action in the
   right group optimistically.
   *Why:* capture-where-you-think. A lawyer should jot "Reply to notice — Sharma — Fri — P1"
   without navigating into the matter. **Impact: high · Effort: M.** From Todoist quick-add +
   Height inline composer.

5. **Surface counts on the filter chips and a one-click "Reschedule overdue".** "Open 12 ·
   Overdue 4 · Done 30". Next to the Overdue group header, a "Reschedule" action that bumps
   selected/all overdue to a chosen date.
   *Why:* lawyers want the size of the problem and a fast way to clear a backlog of slipped
   deadlines. **Impact: med · Effort: S (counts) / M (reschedule).** From Todoist Overdue +
   Reschedule.

6. **Add a Display popover: Group by (Due date / Status / Matter / Priority) + Sort + Layout.**
   One menu, replacing hardcoded behavior, persisted in the URL (matches existing searchParam
   pattern).
   *Why:* different days need different lenses (by deadline for triage, by matter for a case
   review). **Impact: med · Effort: M.** From Todoist Display popover.

7. **Add search + a matter/client filter.** A search box (title) and a matter/client dropdown
   filter in the header.
   *Why:* past ~20 actions the flat list is unusable; "show me everything for the Sharma matter"
   is a constant need. **Impact: med · Effort: S–M.**

8. **Task detail panel (slide-over) with subtasks + activity.** Clicking a row opens a right
   slide-over: title, matter, status, priority, due date, description, subtasks, and the
   immutable remarks/activity. Reuse the matter timeline pattern.
   *Why:* an Action like "File written statement" has sub-steps and a paper trail; lawyers need
   the audit history. **Impact: med · Effort: L.** From Linear/Qatalog/Asana detail panels.

9. **Keyboard + bulk select.** `c` to create, multi-select checkboxes with a bulk bar
   (Complete / Reschedule / Change status).
   *Why:* power users (the lawyer doing their Monday triage) move faster. **Impact: low–med ·
   Effort: M.** From Linear.

10. **Widen the layout for grouped/board views.** Drop `max-w-3xl` (`page.tsx:49`) on Tasks; let
    the grouped list breathe and the board use full width.
    *Why:* desktop real estate is wasted today. **Impact: low · Effort: S.**

---

## Quick wins

1. **Add counts to the filter chips** — "Overdue 4", "Open 12". Pure read-side; data already
   loaded in `all` (`page.tsx:32`). *Effort: S.*
2. **Swap the two native `<select>`s for a colored StatusBadge + priority flag** (click-to-edit
   menu). Biggest visual upgrade per line of code; component exists. *Effort: S–M.*
3. **Group the list by due-date horizon** (Overdue / Today / This week / Later / No date) with
   sticky count headers — no new data, just client-side bucketing in `tasks-list.tsx`. *Effort:
   M but high payoff.*
4. **Color overdue dates red and "today" amber** in `DueDateBadge`, and sort no-date tasks into
   their own group instead of silently last. *Effort: S.*
5. **Add a top-right "Add task" button** that opens the existing matter-action create flow with a
   matter picker prefilled — removes the dead-end empty state. *Effort: S–M.*
