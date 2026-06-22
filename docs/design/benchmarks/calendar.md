# Calendar / agenda — UX benchmark

Surface owner doc for the Legal Owl **Calendar** route. Benchmarks execution against best-in-class
web calendars/agendas. The dark mint/lemon theme is a fixed constraint — we benchmark layout,
hierarchy, and interaction, not the choice of dark.

Mobbin searches run: 6 (4 screen searches across agenda lists, month grids, day timelines, and
overdue/today/upcoming task lists; 1 flow search for event creation; plus the initial agenda search).

---

## Current state (Legal Owl)

File: `apps/web/app/(app)/calendar/page.tsx` (single Server Component, ~117 lines).

**What it does today:**

- Fetches two collections in parallel: `hearings` (state `scheduled`, `hearing_date >= today`) and
  `deadlines` (`due_date >= today`), each joined to its parent matter (`page.tsx:34-48`).
- Merges them into a flat `AgendaItem[]`, sorts ascending by date, then groups into a `Map` keyed by
  ISO date so each calendar day renders as one section (`page.tsx:50-72`).
- Renders a centered single column (`max-w-3xl`) under a `PageHeader`. Each day is a `<section>` with
  a serif date heading + a relative-day chip ("Today"/"Tomorrow"), and a bordered card whose rows are
  divided list items (`page.tsx:74-113`).
- Each row: an icon (`Landmark` for hearing, `AlarmClock` for deadline — lemon, or `urgent` red when
  overdue), a truncated label, and a right-aligned matter link to `/matters/{id}` (`page.tsx:93-106`).
- Empty state via `EmptyState` ("Nothing scheduled") (`page.tsx:79`).

**Strengths:**

- Clean, legible, correctly grounded — every row is one tap from the source matter. The
  hearing-vs-deadline icon + color distinction is a good start.
- Day-grouping with relative labels is the right primitive for a lawyer's "what's next" mental model.
- Server-rendered, fast, no client JS. Good baseline.

**Concrete weaknesses:**

1. **It is forward-only and read-only.** The query is `>= today` (`page.tsx:39,46`), so *overdue
   deadlines and missed hearings never appear* — the single most dangerous omission for a litigator
   (a missed limitation date is malpractice). There is no past view, no month view, no day view, no
   way to create or edit anything from this surface.
2. **No "today" anchoring or time-of-day.** Hearings carry only a date, no time/court/judge. A lawyer
   cannot tell from the agenda whether a hearing is 10:30 AM at one court or 2:15 PM at another, or
   sequence their morning. There is no current-time indicator and no jump-to-today control.
3. **No filtering or scoping.** Everything across all matters is dumped in one stream. No filter by
   type (hearing vs deadline), by client/matter, by court, or by time window (this week / this month).
4. **Weak visual hierarchy at scale.** With 40+ items the flat single column becomes a wall. Overdue
   urgency is conveyed only by icon tint, not by a grouped "Overdue" section or count. Day headers and
   rows compete; there's no left-edge date rail to scan vertically.
5. **No counts / density signals.** A day with 3 hearings looks the same weight as a day with 1. No
   "3 events" subhead, no week summary, no empty-day rendering (gaps just collapse).
6. **No event detail affordance.** Clicking a row does nothing; only the matter link is interactive.
   There's no popover/peek with purpose, court, basis, or "mark done / reschedule".
7. **Labels are thin.** Deadline label falls back to `"<Type> deadline"` and hearing to `"Hearing"`
   (`page.tsx:55,62`) — no matter number/CNR, no court, no client name on the row.

---

## Inspiration gallery

### Pattern A — Agenda / schedule list grouped by day (closest to today's surface)

**Craft — Calendar (agenda)** · [mobbin](https://mobbin.com/screens/b8b55a2e-f8c7-404a-a77c-2a3d2d86fb44)
- A bold **left date rail** ("Apr 7 / Today / Tuesday") sits in its own column; content lives to the
  right. This vertical date spine makes the list scannable in one eye-sweep — far stronger than Legal
  Owl's inline date heading.
- **Empty days are still rendered** as thin rows, so the rhythm of the week is visible (you see the
  gaps, not just the busy days). This is exactly what a lawyer needs to spot a clear afternoon.
- "Show Previous Days" toggle at the top — past items are one click away without cluttering the
  forward view. Directly addresses Legal Owl's forward-only flaw.
- Today's rail cell is tinted/filled, giving a strong "you are here" anchor.

**Workable — Agenda** · [mobbin](https://mobbin.com/screens/25c08d68-4952-4ba3-aab4-bf43db02839a)
- Two-column layout: a **persistent left filter panel** ("Filter by type" with checkboxes: Call,
  Interview, Meeting; "Filter by job") beside the agenda. The agenda re-scopes live. This is the
  filtering model Legal Owl lacks (type = hearing/deadline; job = matter/client).
- Each row leads with a **big day-number + weekday** ("29 MAY, WED"), then a **time range**, then the
  entity link inline in the sentence. Time-of-day is first-class.
- A per-row secondary action ("View scorecard") shows how to attach a contextual action to each agenda
  item — our equivalent: "Open matter" / "Mark filed".

**Jobber — Schedule (list)** · [mobbin](https://mobbin.com/screens/fb9e93ab-0399-4794-9b61-6db077c2acc6)
- Items are bucketed by **status group, not just date**: "Unscheduled / Overdue / Today / Tomorrow /
  This Week", with **Overdue rendered in red** as its own section. This is the single most important
  pattern for Legal Owl — surface overdue deadlines loudly, grouped, at the top.
- A right-aligned column shows **due date + assignee/owner** consistently, and a `List | …` view
  switcher + Filters (with an active-count badge) + "More Actions" sits in a clean toolbar.
- A descriptive subline under each item ("re: ASMobbin", a one-line context) gives grounding without
  opening the record — analogous to showing court/CNR/client on our rows.

**Calendly — Scheduled events** · [mobbin](https://mobbin.com/screens/b3e0fae3-2e15-4f7b-bf01-01585ecabf57)
- **Upcoming / Pending / Past tabs** + a Date Range filter + Export — a tidy way to give time-window
  control without a full calendar grid.
- Colored dot per event type, a clear day header ("Tuesday, August 6, 2024"), time range, and a
  right-edge "Details" disclosure per row. Confirms the row → detail peek pattern.

**Todoist — Today (overdue + dated groups)** · [mobbin](https://mobbin.com/screens/b68ba7de-86f1-4c91-9af5-156007c306c1)
- An **"Overdue" section with a "Reschedule" shortcut** at the top, then "Today · Monday" etc. Overdue
  items show their original date in red ("21 Aug", "Yesterday"). This is the gold standard for "you
  are behind, here's how to fix it fast" — map "Reschedule" → "Adjourn / set new date".

### Pattern B — Month grid with colored events (a view we don't have yet)

**HoneyBook — Calendar (month)** · [mobbin](https://mobbin.com/screens/2343499e-2f24-43d7-9804-075643145c81)
- Classic month grid with **multiple colored event chips per day**, a left **calendar-source legend**
  (Booked Projects / Meetings / Payments / Tentative — color-coded). For us: Hearings / Deadlines /
  filing windows as distinct colors. Today's cell shows a filled date badge.
- Top toolbar: `< March 2025 >` title, `Calendar | Scheduler` tabs, and a `Month ▾` view switcher with
  a `TODAY` button — the canonical control cluster every calendar needs.

**Front — Calendar (month, sparse)** · [mobbin](https://mobbin.com/screens/0e2cff21-2e3e-44e3-a0bc-95fc6ccfa05c)
- Demonstrates a restrained month grid where events are pill chips with a leading time ("9 AM Finance
  discussion"). Even sparse, the grid communicates the shape of the month. A left mini "New event" +
  source toggles. Shows month view works fine in a muted palette.

**Amie — Week timeline** · [mobbin](https://mobbin.com/screens/c980111c-ab7c-42e2-81b2-8abe6ae0c874)
- Beautiful dense **week timeline** with soft pastel blocks, a live red **current-time line**, and a
  left "today / inbox" task rail that coexists with the grid. The red now-line is a small detail that
  hugely improves day/week orientation — worth stealing for any timed view.
- A floating bottom control bar (search / layout / settings) keeps chrome minimal.

### Pattern C — Day view with hourly timeline

**Evernote — Day view** · [mobbin](https://mobbin.com/screens/0be7c945-ab38-40ba-a7fc-25f989981262)
- Single-day hourly timeline with event blocks; a **left mini-month picker + calendar source list**;
  a `Day ▾` switcher (Day/Week/Month/Schedule) top-right with `New Event`. Events show an inline
  "Add Note" action. A clean reference for a focused "what does my hearing day look like" view.

**Zoho CRM — Day view with "Overdue Activities" banner** · [mobbin](https://mobbin.com/screens/1d83ff92-a192-4ae5-a9b5-76e73fda96e9)
- The day view pins an **"Overdue Activities (1)" red banner above the timeline** and an All-Day row.
  Even inside a date-scoped view, overdue work is never hidden. Great pattern for deadlines.

**Clockwise — Day view with empty-state copy** · [mobbin](https://mobbin.com/screens/eb1f6f40-bd78-4605-9e0b-aac96b483533)
- "No upcoming meetings today / Your time is all yours" — a warm, useful empty state inside a day with
  a working timeline. Better than a generic "Nothing scheduled".

### Pattern D — Overdue / today / upcoming buckets (for the agenda backbone)

**monday.com — My Work** · [mobbin](https://mobbin.com/screens/dbe5b273-187f-4f5f-9983-bf7aa7e6bfbd)
- Collapsible date buckets with **item counts** ("Overdue / 0 items", "Today / 0 items", "This week",
  "Next week", "Later", "Without a date"). The counts let you triage at a glance and collapse what's
  empty. Exactly the skeleton a lawyer agenda should adopt.

**ClickUp — grouped by due date** · [mobbin](https://mobbin.com/screens/777d598b-8796-4971-8cc6-c85d8742c975)
- "Today / Monday / Thursday / Future" groups with a **Group by: Due date** control and per-row due
  date + priority columns. Shows the group-by toggle as a first-class affordance.

**Attio — Tasks grouped, with Group-by menu** · [mobbin](https://mobbin.com/screens/33f14e4f-7f5f-4844-9d76-5dbd6ac20f8b)
- "This week / Upcoming / Completed" with overdue dates in red ("Due tomorrow", "Due Aug 15") and a
  **Group by menu (Due date / Assignee / Creation date)**. Clean, minimal, exactly our scale.

### Pattern E — Creating / editing an event (flow)

**Front — Creating an event** · [flow](https://mobbin.com/flows/ccd04cdd-9c41-4ccd-8a77-6dac1b823f7f)
- A **right-side slide-in panel** (not a modal that blocks the calendar): title field, start/end date
  + time dropdowns, all-day + repeat, guests, location, attach files, description, reminder
  ("30 minutes" + Add notification), visibility. Progressive disclosure — the essentials are at top,
  power options below. Editing happens in the same panel. The calendar stays visible behind it for
  context. This is the ideal "add hearing / add deadline" surface.

**Amie — Creating an event** · [flow](https://mobbin.com/flows/2901ed8e-9087-46e6-b829-3d4a75466e33)
- Inline creation: drag/click on the grid spawns a block, then an inline popover for title + a
  compact detail sheet (guests, location, time, repeat, color). Fast, keyboard-friendly.

**Skiff — Creating a new event** · [flow](https://mobbin.com/flows/278b5778-83b4-4ad3-a5ea-296d26fa2abb)
- Minimal left panel: title, date, time range, all-day, repeat, participants, **color swatches**,
  location, description. A good lightweight template if we don't need guests/conferencing.

**Evernote — Create event (modal)** · [mobbin](https://mobbin.com/screens/68143775-c815-4aa9-a884-2040a40c3164)
- Compact modal: Start / End (date + time), Calendar (color-coded source) — the smallest viable
  create form. Useful as the "quick add" variant.

---

## Gaps vs. best-in-class

| Gap | Today in Legal Owl | Best-in-class reference |
| --- | --- | --- |
| Overdue items hidden | `>= today` filter drops them | Jobber, Todoist, Zoho, monday, Attio all surface overdue prominently |
| No view switcher | Agenda only | HoneyBook / Evernote `Day · Week · Month · Schedule` |
| No time-of-day | Date only on rows | Workable, Calendly, Amie show time ranges; Amie/Zoho show now-line |
| No filtering/scoping | All matters in one stream | Workable left filter panel; ClickUp/Attio Group-by menu |
| No counts / triage buckets | Flat date groups | monday "Overdue / Today / This week + counts" |
| No create/edit from calendar | Read-only | Front/Amie/Skiff create panels |
| Thin row context | "Hearing" / "X deadline" | Jobber "re:" subline; Workable inline entity links |
| Generic empty state | "Nothing scheduled" | Clockwise "Your time is all yours"; Craft renders empty days |
| No "today" anchor / jump | none | Today button + filled today cell everywhere |
| No event detail peek | row inert | Calendly "Details" disclosure; Jobber row → record |

---

## Recommendations

1. **Surface overdue deadlines & missed hearings in a pinned "Overdue" section at the top (red).**
   Change the query to also fetch `due_date < today` (open) deadlines and past scheduled hearings, and
   render an "Overdue (N)" bucket above Today with each item showing its original date in red. For a
   litigator this is the highest-stakes information on the screen.
   *Why:* a missed limitation/filing date is malpractice. *Impact: high. Effort: M.*
   *From: Jobber, Todoist, Zoho CRM, Attio.*

2. **Restructure the agenda into relative buckets with counts: Overdue · Today · Tomorrow · This week ·
   Later.** Keep exact-date subgroups inside each. Add an item count to each bucket header and collapse
   empty ones.
   *Why:* lawyers triage by urgency window, not raw dates; counts give instant load sense.
   *Impact: high. Effort: M.* *From: monday.com, Jobber, ClickUp.*

3. **Add a top toolbar: view switcher (Agenda · Week · Month), a Today button, and prev/next period.**
   Ship Agenda + Month first (Month is the most-requested "court diary" mental model in India), Week/Day
   later. Render today's cell filled and a live red now-line in timed views.
   *Why:* lawyers think in monthly cause-list terms; a month grid maps to their paper diary.
   *Impact: high. Effort: L.* *From: HoneyBook, Evernote, Front, Amie.*

4. **Add a filter row: by type (Hearing / Deadline), by Client/Matter, and by Court.** A compact
   filter bar (or left panel on wide screens) with an active-count badge.
   *Why:* a lawyer with 60 active matters needs "show me only this week's hearings at the High Court".
   *Impact: high. Effort: M.* *From: Workable, ClickUp, Attio (Group-by + Filter).*

5. **Enrich each row: time, court, client, and matter number/CNR.** Lead hearings with their time;
   add a muted subline ("Bombay HC · Sharma v. State · CNR ...") using Geist Mono for the case number.
   Make the whole row open a detail peek, not just the matter link.
   *Why:* the agenda becomes actionable without drilling into each matter. *Impact: high. Effort: M.*
   *From: Jobber "re:" subline, Workable inline links, Calendly Details.*

6. **Add a right-side "Add / edit event" slide-in panel** for creating hearings and deadlines from the
   calendar (title, type toggle, matter picker, date, time, court, basis, reminder). Edit reuses the
   same panel; calendar stays visible behind it.
   *Why:* today the calendar is a dead end; lawyers add the next hearing date the moment they leave
   court. *Impact: med-high. Effort: L.* *From: Front, Amie, Skiff create flows.*

7. **Add a left vertical date rail to the agenda and render empty days.** Move the date (big day-number
   + weekday) into a fixed-width left column; show empty days as thin rows so the week's rhythm and
   free slots are visible.
   *Why:* one-sweep scanning + spotting open days for new commitments. *Impact: med. Effort: M.*
   *From: Craft, Workable.*

8. **Per-row contextual actions: "Mark filed / done", "Adjourn (reschedule)", "Open matter".** On
   overdue deadlines show a one-tap reschedule like Todoist.
   *Why:* close the loop in place. *Impact: med. Effort: M.* *From: Todoist Reschedule, Workable, Jobber.*

---

## Quick wins

1. **Stop hiding overdue work.** Even before full buckets, change the deadline query to include
   `due_date < today` (open) and render those rows first with the red `urgent` styling already in the
   file (`isOverdue` exists at `page.tsx:5,98`). One query change, large safety win. *Impact: high. Effort: S.*

2. **Add a "Today" jump + filled today section.** Anchor scroll to today and tint the today section
   header background, not just the relative-day text. *Effort: S.* *From: every reference.*

3. **Show counts in day/bucket headers** ("3 events"), reusing the grouped `Map`. *Effort: S.*
   *From: monday.com.*

4. **Put time-of-day on hearing rows.** If `hearings` has a time component, render it leading the row
   in Geist Mono; otherwise add an optional time field. *Effort: S.* *From: Workable, Calendly.*

5. **Warmer, role-specific empty state.** Replace "Nothing scheduled" with something like "No hearings
   or deadlines coming up — your diary is clear." *Effort: S.* *From: Clockwise.*
