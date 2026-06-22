# Home / daily agenda dashboard — UX benchmark

Surface: the logged-in lawyer's Home landing — the "command center" first screen
that should answer "what do I need to do today, and what changed since I last
looked?"

Files reviewed:
- `apps/web/app/(app)/home/page.tsx`
- `apps/web/app/(app)/home/actions.ts`

---

## Current state (Legal Owl)

### What exists today

The Home page (`home/page.tsx`) is a single Server Component that, after a
`matterCount === 0` guard that swaps in an `Onboarding` screen (`page.tsx:39`),
runs five parallel Supabase queries (`page.tsx:41-76`) and renders a single
narrow column (`max-w-3xl`, `page.tsx:81`) of stacked sections:

1. **Header** — `Home` title + today's long date (`page.tsx:82-83`).
2. **Inbox alert banner** — a lemon-tinted pill linking to `/inbox`, shown only
   when `inboxCount > 0`: "{n} court update(s) need your review → Open inbox"
   (`page.tsx:85-97`).
3. **Three stat tiles** — Open tasks / Overdue / In inbox, each a `Stat` linking
   to a filtered list (`page.tsx:99-103`).
4. **Next hearings** — up to 5 scheduled hearings ≥ today, each row: a `Landmark`
   icon, matter title, purpose + forum label, and a `HearingPill` date
   (`page.tsx:105-131`).
5. **Needs attention** — overdue tasks (only if any), up to 5, with a red "due"
   chip (`page.tsx:133-152`).
6. **Upcoming deadlines** — up to 5 deadlines ≥ today with an `AlarmClock` icon
   and relative day (`page.tsx:154-172`).

`Onboarding` (`page.tsx:177-198`) is a centered welcome with "Load sample data"
(a server action that seeds 3 clients/matters, `actions.ts:12-169`) and "Add
your first matter".

### Strengths

- **Right instinct on content.** It surfaces the four things that matter to a
  litigator — hearings, overdue work, deadlines, inbox triage — which is exactly
  the correct mental model for a command center. Hearings-first ordering is good.
- **Everything is a deep link.** Stat tiles and every row navigate to the
  relevant matter or filtered list, so the dashboard is a launchpad, not a
  dead end.
- **Conditional rendering keeps it honest.** Empty sections (overdue, deadlines)
  collapse rather than showing zeros, so the page stays short on quiet days.
- **Strong empty/onboarding state** with one-click sample data — a genuinely
  good first-run experience that many B2B tools lack.
- **Tabular-figure dates** (`tnum`) and forum/hearing badges give it a
  professional, scannable density.

### Concrete weaknesses

1. **No actual "today" frame.** The page is titled "Home" and shows the date,
   but there is no *today* segmentation. Hearings are "≥ today" up to 5
   (`page.tsx:65-67`) — a hearing today and a hearing in three weeks look
   identical. A lawyer cannot tell at a glance "do I have court this morning?"
   There is no "Today / This week / Later" grouping and no time-of-day for
   hearings (the schema only stores `hearing_date`, no time).
2. **Stat tiles are vanity counts, not a plan.** "Open tasks: 14" is not
   actionable; it is the same number every morning. Best-in-class command
   centers lead with *what to do now*, not aggregate counts.
3. **Single narrow column wastes the canvas.** `max-w-3xl` on a desktop legal
   tool leaves huge empty gutters. Every reference below uses a two-pane or
   multi-card grid (agenda beside work) so the lawyer sees hearings AND tasks
   without scrolling.
4. **No "what changed" / activity dimension.** The inbox banner is a count, but
   there is no feed of *what* happened (order uploaded, date moved) — the
   product's core differentiator (court monitoring) is reduced to a number on
   Home. Compare Rox's "Recommended Actions" feed.
5. **Overdue tasks and today's tasks are conflated/missing.** "Needs attention"
   shows only *overdue* tasks (`due_date < today`, `page.tsx:55-58`). Tasks due
   *today* appear nowhere on Home — the single most important list for a daily
   planner is absent.
6. **No greeting / personalization / time-awareness.** No "Good morning,
   [name]". Minor, but every reference dashboard opens with it and it warms an
   otherwise clinical screen.
7. **No quick actions.** No "New matter / Add task / Log a note" affordance on
   Home — the lawyer must navigate away to do anything. Cycle and ClickUp both
   put a quick-action row on Home.
8. **No inline completion.** Rows are read-only links. You cannot tick off a
   task or snooze a deadline from Home; you must open the matter. ClickUp's "My
   Work" and Rox's Tasks card both allow inline checkoff.
9. **Truncation hides the forum/CNR.** Hearing rows truncate the matter title
   and bury the forum after a `·`; the case number (CNR), a litigator's primary
   key, never appears on Home.
10. **No "all clear" positive empty state for the day.** When there are no
    hearings, the section shows a generic "No upcoming hearings" rather than a
    reassuring "You're clear today" — ClickUp's "Woohoo, you're all done!" is a
    nice morale beat.

---

## Inspiration gallery

### Pattern A — Multi-card "Home" grid: agenda + my work side by side

**ClickUp — Home** ([mobbin](https://mobbin.com/screens/0786eedb-9b68-4dca-bf49-7e97ce585376), [variant 2](https://mobbin.com/screens/df2294f6-0811-40aa-8dce-093bab47ac34), [variant 3](https://mobbin.com/screens/3238339d-fc0a-46a5-aae1-a853fae210ba))
- A **2×2 card grid** ("Recents", "Agenda", "My Work", "Assigned to me") fills
  the full width — the antithesis of Legal Owl's single skinny column. Each card
  is independently scrollable and titled.
- **"My Work" is grouped by time bucket** — `Today / Overdue / Next /
  Unscheduled`, each with a live count (`Today 1`, `Overdue 3`). This is exactly
  the "today frame" Legal Owl lacks; the count next to each bucket lets you
  triage before expanding.
- Opens with a **time-aware greeting** ("Good morning, Sam" / "Good afternoon,
  Sam") — instantly personal and orients you to the day.
- **Agenda card pulls from connected calendars** with a date stepper and a
  "Today" button, so events and tasks live on the same screen.
- Strong **empty states inside each card** with an illustration + "Learn more"
  CTA, so an empty dashboard still teaches.

**ClickUp — Home with right-rail calendar** ([mobbin](https://mobbin.com/screens/c981c40c-fd97-41bf-920a-06dfe6324abb), [dark variant](https://mobbin.com/screens/4687f788-b9dc-44bb-8eb1-16f3ad299f87))
- **Two-pane layout: task list left, a real time-gridded day calendar right.**
  The calendar shows the current-time line and the day's blocks (e.g. "Create a
  template 3:30–6:30"). For a lawyer, this is the model for "hearings on a
  timeline" beside "tasks to do".
- "My Work" again uses `Today / Overdue / Next / Unscheduled`; the **"LineUp"**
  strip at top pins your 1–3 most important items for the day — a curated "do
  these first" lane above the noise.
- The **dark variant** is directly relevant given Legal Owl's fixed dark theme:
  it shows this exact layout reads well on dark, with the calendar grid muted and
  task rows high-contrast.

**Notion — Home** ([mobbin](https://mobbin.com/screens/c82e9357-50f8-4841-9bd7-8ac72dc701f1))
- Compact **"My tasks"** strip with inline status pill ("In progress"), "Add
  Due", and quick links — shows a task can carry its status + a quick-edit
  affordance inline without leaving Home.
- Sectioned cards (Suggested / Trending / Learn) demonstrate restrained card
  hierarchy with clear, quiet section headers.

### Pattern B — "Focus for today": AI/activity feed + agenda + tasks

**Rox — Home ("Here's your focus for today")** ([mobbin](https://mobbin.com/screens/62b4d10c-498e-49eb-bf78-3b944290f407), [no-meetings variant](https://mobbin.com/screens/9afac370-aa6f-4ff5-9679-9d9d4c02cf3d), [dark variant](https://mobbin.com/screens/ac3c5128-08d9-485f-b264-c034728c61c8))
- The single most relevant reference. Layout is **a big left "Recommended
  Actions" feed + a right rail split into "Today" (meetings) over "Tasks".**
- **"Recommended Actions (7)"** is a ranked, filterable feed of *things that
  happened and need a decision* — each item has a source tag ("News"), a
  timestamp ("9h ago"), a one-line summary, and an inline action button ("View
  Session →", "Follow Up →"). This is precisely what Legal Owl's court-monitoring
  inbox should look like *on Home*: not a count, but a triage feed with verbs.
- The right rail's **"Today"** card lists timed meetings with a per-item action
  ("Prepare →", "Follow Up →") — map directly to hearings with "Prep →".
- The sub-header **"Here's your focus for today"** frames the whole screen as a
  daily plan, not a database.
- **Tasks card has inline checkoff + a "Show completed" toggle** and an
  "All tasks completed" celebratory empty state — the morale beat Legal Owl
  misses. The dark variant proves the whole pattern works on a dark canvas.

**Charma — Today's Schedule** ([mobbin](https://mobbin.com/screens/4eacbfa1-0d16-437a-bffc-ddfbf04bc2b4), [with notifications popover](https://mobbin.com/screens/2268da84-9c1d-41f7-9dda-ebc7df71912a))
- **"Your Action Items" split into `Due Today` and `Upcoming`** in a tabular
  layout (item | due date | owner) — a clean, dense way to show what's due when,
  with a visual left-border accent on the active group.
- A **"Today's Schedule" right column** lists the day's meetings as time-stamped
  cards. Same two-zone "do + schedule" split as Rox.
- A **notifications popover** ("It's time to check in on your goal…") shows how
  to surface nudges without a full inbox visit.

### Pattern C — "My work" lists (issue/task command centers)

**Linear — My Issues / view options** ([mobbin](https://mobbin.com/screens/f65297dd-67fb-4560-9d89-ab3c179536a8))
- Gold standard for **dense, grouped, scannable work lists**: grouped by status,
  ordered by priority, with a **display-properties panel** to toggle Priority /
  ID / Due Date / Assignee per row. Legal Owl's flat rows could borrow this
  density + the convention of showing the human-readable id (JOH-11) inline,
  analogous to the matter `key`/CNR.
- Priority is a tiny leading glyph, not a chip — keeps rows quiet but scannable.

**Jira — "For you" home** ([mobbin](https://mobbin.com/screens/40ae9e4a-5ba3-41ef-8570-6b63fb959286))
- A **tabbed "Worked on / Viewed / Assigned to me / Starred"** strip over a
  single list lets one panel serve several lenses without more cards — a cheap
  way to add "Today / This week / Overdue" tabs to one section.
- "Recent spaces" cards with quick-link counts ("My open work items 3") show
  how to make an entity card a mini-launchpad.

**Cycle — Home** ([mobbin](https://mobbin.com/screens/3aac2c96-7ec9-4e41-9303-0ade4dfcff23))
- Opens with greeting "Hey, Jane 👋 — Here's what's happening in your
  workspace", a dismissible **product-update announcement banner**, and a
  **"Quick actions" row** of buttons (Add view / New Feedback / New Initiative).
  The quick-actions row is the pattern Legal Owl should copy for "New matter /
  Add task / Log note".

### Pattern D — Stat / overview cards done well

**Whop — Analytics** ([mobbin](https://mobbin.com/screens/0b39694c-dee7-4300-9f2e-ebe25b14c75e)) and **StackAI — Project Analytics** ([mobbin](https://mobbin.com/screens/03fb91f0-89d0-45e6-ada1-34d533a3febf))
- Stat cards pair a **big number with a delta badge ("+$1.40") and a sparkline**.
  The lesson for Legal Owl: if you keep stat tiles, give each one *trend or
  context* (e.g. "3 overdue ▲ 1 vs yesterday") so the number means something.

**Ferndesk — Overview** ([mobbin](https://mobbin.com/screens/a41b87bc-6104-4cc3-8cb6-cfd4620701b1)) and **Mixpanel — Main Dashboard** ([mobbin](https://mobbin.com/screens/b2e7f096-7f25-4cdb-a80e-645ed595f5a1))
- Each stat card carries a **colored top accent + icon + one-line description**
  under the metric ("Unique visitors to your help center"). Mixpanel's "Active
  Users – Today" card shows a single number with a **"+25%" vs previous-period
  delta** — the convention for making a daily count feel like a signal.

### Pattern E — Day timeline planners

**Amie — Working list + day grid** ([mobbin](https://mobbin.com/screens/1ad438ff-b489-41ba-aa9d-01d7c8b8317d)) and **Motion/ClickUp Planner** ([mobbin](https://mobbin.com/screens/98725157-dec0-46de-a5d8-3e929a80e05e))
- A left **"Working List" grouped `No date / Today / Later`** beside a full
  calendar grid; tasks and events coexist and the now-line anchors the day.
  Motion's planner adds a numbered **"Priorities" lane (1,2,3)** above the
  backlog — the "do these three first" idea, useful for a lawyer's
  morning triage.

---

## Gaps vs. best-in-class

| Gap | Legal Owl today | Best-in-class |
| --- | --- | --- |
| No "today" frame | hearings/deadlines are flat "≥ today" lists | ClickUp/Charma/Rox all split `Today / Upcoming / Overdue` with counts |
| Tasks due today missing | only overdue shown (`page.tsx:55`) | ClickUp "My Work → Today"; Rox/Charma "Due Today" |
| Counts, not a plan | 3 vanity stat tiles | Rox "Recommended Actions" feed with verbs; ClickUp LineUp top-3 |
| Single narrow column | `max-w-3xl` | ClickUp 2×2 grid; Rox/Charma two-pane do+schedule |
| No "what changed" feed | inbox is just a number | Rox feed with source tag + timestamp + inline action |
| No inline action | read-only links | Rox/Notion inline checkoff; Rox "Prepare →" per meeting |
| No greeting/personalization | "Home" + date | every reference: "Good morning, [name]" |
| No quick actions | none | Cycle/ClickUp quick-action row |
| Flat stat numbers | bare count | Whop/StackAI/Mixpanel: delta + sparkline + description |
| Weak positive empty state | "No upcoming hearings" | ClickUp "Woohoo, you're all done!"; Rox "All tasks completed" |
| No hearing time / CNR on Home | date only, CNR hidden | Rox/Charma show time-stamped meeting cards |

---

## Recommendations

1. **Reframe Home as "Today" with time buckets.** Replace flat "Next hearings"
   and the overdue-only task list with sections (or one combined agenda) grouped
   `Today / This week / Later`, each with a live count in the header. Add a
   `Due today` task group sourced from `actions where due_date = today` (today's
   tasks are currently absent). *Why:* the litigator's first question is "do I
   have court today and what's due today?" — the screen should answer it in one
   glance. *Impact: high. Effort: M.* From ClickUp "My Work" + Charma "Due
   Today".

2. **Go two-pane (or 2-col grid) and use the width.** Lift `max-w-3xl` to a
   wider container; put **agenda/hearings on the left, tasks + deadlines on the
   right** (stack on mobile). Optionally a compact right-rail "Today" timeline.
   *Why:* desktop is the lawyer's primary surface; the current layout wastes
   ~50% of the viewport and forces scrolling between related info. *Impact:
   high. Effort: M.* From ClickUp Home grid + Rox two-pane.

3. **Turn the inbox banner into a "What changed" feed card.** Instead of a
   one-line count, render the top 3–5 `triage_items` as a ranked feed: kind icon,
   one-line summary, matter, timestamp ("8h ago"), and an inline primary action
   ("Review →" / "Add task"). Keep "Open inbox ({n})" as the card footer. *Why:*
   court monitoring is the product's differentiator; Home should show *what
   happened*, not just that something did. *Impact: high. Effort: M.* From Rox
   "Recommended Actions".

4. **Add a time-aware greeting + quick-action row.** Header becomes "Good
   morning, {first name}" with the date as a sub-line, and a row of buttons:
   `New matter · Add task · Log note`. *Why:* warmth + removes the navigate-away
   tax for the most common create actions. *Impact: med. Effort: S.* From Cycle
   greeting + quick actions; ClickUp greeting.

5. **Make stat tiles signals, not vanity counts.** Either (a) drop the "Open
   tasks" tile and keep only actionable ones (Overdue, Due today, Inbox), or (b)
   add context to each: a delta vs yesterday and/or a tiny inline state (e.g.
   "Overdue 3 — oldest 5d"). *Why:* a static count gives no reason to act; a
   delta or "oldest" hint does. *Impact: med. Effort: S–M.* From Whop/Mixpanel
   stat cards.

6. **Inline checkoff + snooze on Home rows.** Add a checkbox to task rows
   (client island calling a `completeAction` server action via `useTransition`)
   and a snooze on deadlines/triage. *Why:* a lawyer scanning Home in the
   morning should be able to clear trivial items without opening each matter.
   *Impact: med. Effort: M.* From Rox/Notion inline task cards.

7. **Show hearing time + forum + CNR per hearing row.** Surface `hearing_date`
   with time (add a time column to the schema, or show "All day" until then),
   the forum label as a badge (not after a `·`), and the matter `key`/CNR in
   Geist Mono. *Why:* CNR/forum are how litigators identify a case; truncating
   them loses the row's primary key. *Impact: med. Effort: S (UI) / M (schema for
   time).* From Rox/Charma time-stamped cards + Linear inline IDs.

8. **Positive "all clear" empty states per section.** When there are no hearings
   today or no overdue tasks, show a reassuring line + small mark ("You're clear
   today — no hearings, nothing overdue") instead of a flat "No upcoming
   hearings". *Why:* a clean morning should *feel* clean; it's a cheap morale and
   trust signal. *Impact: low. Effort: S.* From ClickUp "Woohoo" / Rox "All
   tasks completed".

9. **Add a "Pinned / Do first" lane (optional, later).** Let the lawyer pin 1–3
   matters or tasks to a top strip on Home. *Why:* mirrors how lawyers actually
   work a hot matter for days. *Impact: med. Effort: L.* From ClickUp LineUp /
   Motion Priorities.

---

## Quick wins

1. **Add tasks-due-today.** New query `actions where completed_at is null and
   due_date = today`, rendered as a "Due today" section above "Needs attention".
   Closes the biggest content gap with a one-query change. (Effort: S)
2. **Time-aware greeting.** "Good morning/afternoon/evening, {first name}" in the
   header — pull name from the auth user; date moves to a sub-line. (Effort: S)
3. **Widen the container.** Bump `max-w-3xl` → `max-w-5xl`/`max-w-6xl` and move
   "Upcoming deadlines" beside "Next hearings" in a 2-col grid on `lg`. Instant
   density win, no new data. (Effort: S)
4. **Positive empty state copy.** Swap "No upcoming hearings" for "You're clear
   — no hearings scheduled" and add an "all done" state when overdue + due-today
   are both empty. (Effort: S)
5. **Quick-action row.** Three buttons under the header (`New matter`,
   `Add task`, `Log note`) using existing `buttonVariants` + links to existing
   routes. (Effort: S)
