# Legal Owl — UX benchmark synthesis

_Design-lead synthesis of an 11-surface, Mobbin-driven UX benchmark of Legal Owl (off-dark
mint/lemon Next.js web app for solo lawyers & small firms in India; domain hierarchy
Client → Engagement → Matter → Action). Benchmark window: June 2026._

This is the entry point. Each per-surface report has the full current-state audit, an inspiration
gallery with Mobbin links, a gaps table, and prioritized recommendations. This index pulls the
threads together: what recurs across surfaces, the ten highest-leverage moves product-wide, and a
sequenced Now / Next / Later roadmap.

> **Fixed constraints (do not benchmark these away):** the off-dark mint/lemon theme is a deliberate
> product choice (`app/globals.css`); shadcn-on-Base-UI primitives (`render` prop, `type="submit"` on
> form buttons); Server Components for reads, Server Actions for writes; RLS keyed on
> `auth.uid() = lawyer_id`. We benchmark **execution**, not the palette or the stack.

---

## The reports

| Surface | Report | One-line current state |
|---|---|---|
| Marketing landing page | [`landing.md`](./landing.md) | Strong type-led dark page, one good product mock, but converts on a single email field with **zero social proof** and a **dead `#top` final CTA**. |
| Auth & waitlist onboarding | [`auth-onboarding.md`](./auth-onboarding.md) | Brand-coherent, but **no password recovery**, a "Create account" button that silently bounces to the waitlist, and a one-shot first-run instead of a tracked checklist. |
| Home / daily agenda | [`home-dashboard.md`](./home-dashboard.md) | Right content instinct, but **no "today" frame**, no tasks-due-today, vanity counts, and a narrow single column wasting half the desktop. |
| Calendar / agenda | [`calendar.md`](./calendar.md) | Clean grounded agenda, but **forward-only & read-only** — the `>= today` filter **hides overdue deadlines and missed hearings** (malpractice risk). |
| Matters list | [`matters-list.md`](./matters-list.md) | Right primary sort (hearing-first), but **status & CNR invisible on rows**, no counts, no grouping, no saved views. |
| Matter detail (case file) | [`matter-detail.md`](./matter-detail.md) | Merged court-events+remarks timeline is the strongest idea; weak on a **persistent facts rail**, flat timeline, document grouping, and **no AI/ask-the-matter** despite it being the core bet. |
| Clients, intake & conflict | [`clients.md`](./clients.md) | Calm routes + a real conflict engine, but the **conflict check runs silently** with no in-flow pass/fail artifact; detail never shows captured Address/GSTIN/PAN and has no edit. |
| Inbox / triage | [`inbox-triage.md`](./inbox-triage.md) | Good triage verbs and accept-into-task, but **100% mouse-driven**, no detail/preview, no snooze choice, no undo. |
| Tasks | [`tasks.md`](./tasks.md) | Good inline edits, but **no grouping, no board over `workflow_states`, no quick-create**, and status/priority shown as noisy native selects. |
| Settings | [`settings.md`](./settings.md) | **Entirely read-only** — no `actions.ts`; identity/firm not editable, two dead "soon" buttons, no notification prefs. |
| Design system, nav & theme | [`design-system-nav.md`](./design-system-nav.md) | Excellent StatusBadge/DueDateBadge primitives; cross-cutting weak spots: flat nav, **text-only empty states**, navigation-only ⌘K, duplicated page title, light-tuned shadows on dark. |

---

## Cross-cutting themes

These patterns recur across most surfaces. Fixing them once (often in shared primitives) lifts the
whole product — they are the backbone of the roadmap.

### 1. Overdue / urgency is hidden, not surfaced (safety-critical)
The single most dangerous, repeated flaw. The Calendar's `>= today` filter **drops overdue deadlines
and missed hearings entirely**; Home shows overdue-only but never tasks-due-today; Matters and Tasks
don't escalate the hearing/due pill for today/overdue; the matter timeline leads with the past, not
upcoming obligations. For a litigator a missed limitation date is malpractice — overdue must be the
loudest thing on every surface. _(calendar, home, matters-list, tasks, matter-detail)_

### 2. No "today / time-horizon" framing or grouping
Home, Calendar, Matters, Tasks, and Inbox all render **flat, ungrouped lists**. Best-in-class
(Linear, ClickUp, Todoist, monday) universally group by `Overdue / Today / This week / Later` with
**per-group counts and collapse**. This one pattern is the highest-frequency recommendation in the
whole benchmark. _(home, calendar, matters-list, tasks, inbox-triage)_

### 3. Counts and signals are missing everywhere
Filter pills, nav items, and stat tiles carry **no counts** (only Inbox has a nav badge). Stat tiles
are vanity numbers, not signals (no delta, no "oldest overdue"). Lawyers want the *size of the
problem* before they click. _(home, matters-list, tasks, inbox-triage, clients, design-system-nav)_

### 4. Narrow single column wastes the desktop
Home, Matter detail, Calendar, Matters, Tasks, Clients are all `max-w-3xl` centered columns that
leave ~half a desktop viewport empty. The recurring fix is **two-pane / properties-rail / grouped
multi-column** layouts (agenda+work; stream+facts-rail; list+detail). _(home, matter-detail,
calendar, matters-list, tasks, clients)_

### 5. Keyboard, command, and quick-capture flows are absent
Inbox is mouse-only; Tasks has no create entry point; ⌘K is navigation-only (no recents, shortcuts,
or contextual actions). High-volume, repetitive work (triage, task capture) demands keyboard-first
flows and quick-create where you think. _(inbox-triage, tasks, design-system-nav, home)_

### 6. The status/badge system is strong but inconsistently applied
`StatusBadge` (shape+color, colour-blind-safe) and the `DueDateBadge` urgency ramp are best-in-class
— but the Matters list **never shows a status badge on a row**, Tasks uses **raw native selects**
instead of pills, and the hearing pill doesn't escalate by urgency. The system exists; it just isn't
used consistently. _(matters-list, tasks, design-system-nav, home)_

### 7. Empty / first-run / confirmation states are thin
Empty states are text-in-a-dashed-box with no icon, education, or no-results variant. Onboarding is a
one-shot screen, not a tracked checklist. The conflict check produces no positive "no conflicts
found ✓" artifact. Waitlist confirmation is a dead end. These are all teaching/momentum moments left
on the table. _(design-system-nav, auth-onboarding, clients, home)_

### 8. The AI-grounding bet is never surfaced
The product's core differentiator — AI answers grounded in real case data — has **no UI anywhere**.
The matter page holds the grounding data (timeline + documents) but offers no "ask this matter," no
auto-summary, no "summarize this order." This is the biggest strategic gap relative to the product
thesis. _(matter-detail, home — "what changed" feed; clients — activity rollup)_

### 9. Trust / data-residency signals are buried
For a cautious legal audience, "data stays in India" is a single footer sentence on the landing page
and a static row in Settings — never a visible badge, trust band, or proper section. Social proof
(waitlist counts, lawyer quotes with court attribution) is entirely absent. _(landing,
auth-onboarding, settings)_

### 10. Write/feedback model & reversibility are immature
Settings is entirely read-only; Inbox dismiss/snooze are silent and irreversible (risk: burying a
real court order); document delete is a bare unconfirmed trash button. The app needs a standard
save-with-dirty-state + sonner-toast + undo pattern. _(settings, inbox-triage, matter-detail)_

---

## Top 10 highest-impact recommendations (product-wide)

Ranked by leverage (impact × breadth × strategic fit), each tagged with surface, impact/effort, and
the headline inspiration.

1. **Surface overdue everywhere — fix the Calendar `>= today` filter first.** Include `due_date <
   today` / past scheduled hearings and render a pinned red **Overdue** section; escalate the
   hearing/due pills to red (today/overdue) and amber (this week) across Home, Matters, and Tasks.
   _Surfaces: calendar, home, matters-list, tasks · Impact: high · Effort: S–M · From Todoist /
   Jobber / Zoho overdue patterns._

2. **Adopt one shared "time-horizon bucket" pattern (Overdue / Today / This week / Later) with
   counts + collapse.** Apply to Home, Calendar, Tasks, and the default Matters view; reuse the same
   grouping component. _Surfaces: home, calendar, tasks, matters-list, inbox-triage · Impact: high ·
   Effort: M · From Linear / ClickUp / monday._

3. **Reframe Home as a "Today" command center: two-pane, tasks-due-today, and a "what changed"
   triage feed.** Add the missing due-today query, widen the layout, and turn the inbox count banner
   into a ranked feed card with inline actions. _Surface: home · Impact: high · Effort: M · From Rox
   "Recommended Actions" / ClickUp "My Work"._

4. **Add a persistent right-hand "Case facts" rail to Matter detail (2-pane), and lead the timeline
   with Upcoming & Overdue.** Surface matter id `M-…` + CNR (copyable), status, next-hearing
   countdown, nearest deadline, open tasks; then group the timeline with date dividers + per-type
   icons. _Surface: matter-detail · Impact: high · Effort: M · From Linear / Attio / Salesforce._

5. **Ship the AI-grounding surface: "Ask this matter" + case auto-summary + "what changed" feed.**
   The product's core bet has no UI. The matter file is the natural home (timeline + docs are the
   grounding data). _Surfaces: matter-detail, home, clients · Impact: high · Effort: L · From product
   strategy._

6. **Make the conflict check a visible in-flow step with a pass/fail artifact.** Run before finalize;
   show per-match cards with a required proceed+reason, or a green "Conflict check complete — no
   conflicts found ✓"; persist acknowledger/reason; strengthen the engine (match clients/contacts,
   fuzzy, re-run on new matter). _Surface: clients · Impact: high · Effort: M · From Airwallex /
   PayPal / Remote._

7. **Make the Matters & Tasks lists scannable: status badge on every row, counts on filter pills,
   replace native selects with pills + priority flags.** Use the existing `StatusBadge`; surface CNR
   (copyable mono). _Surfaces: matters-list, tasks · Impact: high · Effort: S–M · From Linear /
   ClickUp / Salesforce Cases._

8. **Keyboard-first Inbox triage with snooze menu and undo toasts.** `j/k` nav + `e/h/x` verbs with a
   footer legend; replace silent auto-snooze with a duration menu (hearing-aware default + Tomorrow /
   Next week / Custom); undo toasts on dismiss/snooze. _Surface: inbox-triage · Impact: high · Effort:
   S–M · From Linear / Fibery / Front._

9. **Make Settings real: editable Profile/Firm via a new `settings/actions.ts`, with per-field "why
   this matters" copy and a standard save/toast model.** The lawyer's name/firm power client-update
   emails and the client portal. Replace dead "soon" buttons with Notify-me + status. _Surface:
   settings · Impact: high · Effort: M · From Melio / Time2book / Mural._

10. **Build landing-page trust & onboarding momentum.** Fix the dead `#top` CTA; add waitlist social
    proof + a lawyer-quote/data-residency trust band; turn the one-shot first-run into a persistent,
    progress-tracked "Get started" checklist on Home; add password recovery + stop the "Create
    account" bait-and-switch. _Surfaces: landing, auth-onboarding · Impact: high · Effort: S (CTA) /
    M (trust band, checklist) / L (full) · From ISO Meet / Hex / Adaline / Contra / Adaline checklist /
    Clerk._

---

## Roadmap — Now / Next / Later

Sequenced for leverage and dependency. **Now** = safety-critical + high-impact quick wins + shared
primitives that unblock everything else. **Next** = the structural reframes (layouts, grouping, real
features) that build on the primitives. **Later** = depth, power-user, and forward-looking work.

> Effort key: **S** = hours/≤1 day · **M** = a few days · **L** = ~1–2 weeks.
> Surface tags map to the report files above.

### Now — safety, quick wins, shared foundations

| # | Change | Surface(s) | Impact | Effort | Inspiration |
|---|---|---|---|---|---|
| N1 | **Stop hiding overdue.** Calendar query include `due_date < today` + past scheduled hearings; render overdue first with existing `urgent` styling. | calendar | high | S | Todoist, Zoho |
| N2 | **Escalate hearing/due pills** (red today/overdue, amber this week) in `components/badges.tsx` — fixes urgency everywhere at once. | matters-list, home, calendar, tasks | high | S | Zoho colored date chips |
| N3 | **Add tasks-due-today to Home** (new `due_date = today` query) + positive "You're clear today" empty states. | home | high | S | ClickUp "My Work", Rox |
| N4 | **Status badge + copyable CNR on every Matters row; counts on filter pills + total.** | matters-list | high | S | Linear, Salesforce Cases |
| N5 | **Counts on Tasks filter chips; replace the two native `<select>`s with StatusBadge pill + priority flag.** | tasks | high | S–M | ClickUp, Todoist |
| N6 | **Inbox: snooze duration menu (hearing-aware default + Tomorrow/Next week/Custom) + undo toasts on dismiss/snooze + pending count in header/nav.** | inbox-triage | high | S | Linear, Front |
| N7 | **Fix landing dead `#top` CTA** (inline email form or scroll-and-focus) and add waitlist social proof + a visible "data stays in India" badge under the hero. | landing | high | S | ISO Meet, Base |
| N8 | **Auth honesty + recovery:** add "Forgot password?" (`resetPasswordForEmail`); demote "Create account" to an honest "Request access" link. | auth-onboarding | high | S–M | Clerk, OpenAI |
| N9 | **Make Settings write:** new `settings/actions.ts` with editable Profile/Firm + per-field "appears on client emails" helper copy + sonner save toast; reframe data residency as a trust card. | settings | high | M | Melio, Time2book |
| N10 | **Matter detail quick wins:** show/copy `M-…` id + CNR by the title; write a `court_events` row on document upload (timeline link); confirm the document-delete trash. | matter-detail | high | S | Origin, HoneyBook |
| N11 | **Design-system quick wins:** remove the duplicate page title; group the sidebar into "Today" / "Case files"; add an icon slot to `EmptyState`; bump `--border` one step and drop light-tuned shadows. | design-system-nav | high | S | Linear, Vercel, Todoist |
| N12 | **Clients quick wins:** show captured Address/GSTIN/PAN/Type on detail; broaden list search to email/phone; add a "N clients" count + status chips; add a positive "No conflicts found ✓" confirmation. | clients | high | S | Salesforce, Lightfield |

### Next — structural reframes & real features

| # | Change | Surface(s) | Impact | Effort | Inspiration |
|---|---|---|---|---|---|
| X1 | **Shared time-horizon grouping component** (Overdue/Today/This week/Later, counts + collapse) applied to Home, Calendar, Tasks, default Matters view. | home, calendar, tasks, matters-list | high | M | Linear, ClickUp, monday |
| X2 | **Reframe Home as two-pane "Today"** (agenda left, tasks+deadlines right) + greeting + quick-action row (New matter / Add task / Log note). | home | high | M | Rox, ClickUp, Cycle |
| X3 | **Home "what changed" triage feed card** (top triage_items with kind icon, summary, matter, timestamp, inline action). | home, inbox-triage | high | M | Rox "Recommended Actions" |
| X4 | **Matter detail 2-pane: persistent Case-facts rail** + **Upcoming & Overdue at top of timeline** + date dividers / per-type icons / collapsed system runs + filter chips. | matter-detail | high | M | Linear, Attio, Salesforce, Airbnb, Vercel |
| X5 | **Conflict check as a visible in-flow step** with pass/fail artifact + acknowledgement audit; strengthen engine (clients/contacts, fuzzy, re-run on new matter). | clients | high | M | Airwallex, PayPal, Remote |
| X6 | **Client detail: inline-editable details panel** (`updateClient`) + **rolled-up activity timeline** from matter court_events/remarks + engagement→matter grouping + related-record count cards. | clients | high | M–L | Salesforce, Zoho, Attio |
| X7 | **Tasks quick-create on surface** (top + per-group composer: matter, due, priority) + one-click "Reschedule overdue". | tasks | high | M | Todoist, Height |
| X8 | **Calendar toolbar + filters:** Agenda/Month view switcher, Today button, prev/next; filter by type/client/court; enrich rows (time, court, client, CNR) with a detail peek. | calendar | high | M–L | HoneyBook, Workable, Jobber |
| X9 | **Inbox split list+detail** with structured matter rail and old→new diffs + per-kind icon/severity/contextual CTA + date grouping. | inbox-triage | high | L | Front, Intercom, Lemni |
| X10 | **Persistent progress-tracked "Get started" checklist on Home** (replaces one-shot first-run); make waitlist confirmation a momentum moment (referral/next-steps). | auth-onboarding, home | high | L | Adaline, Better Stack, Contra |
| X11 | **Matters: composable filter chips + Sort-by control + group default by hearing window; saved views with seeded defaults.** | matters-list | high | M–L | Linear, Sentry, HubSpot |
| X12 | **Settings IA: persistent left sub-nav + real Notification preferences** (grouped toggles, editable lead-times) + Security section + integration status pattern. | settings | high | M–L | Melio, Mercury, Revolut, Rox |
| X13 | **Action-oriented ⌘K:** Recent group, per-row shortcut hints, footer legend, contextual matter actions; collapse the 3 route lists into one `lib/nav.ts`. | design-system-nav | high | M | Linear, Vapi |
| X14 | **Landing show-don't-tell:** real screenshot per track + dark testimonial/trust band + problem-framing block + real footer + FAQ. | landing | high | L | Notion, Hex, Adaline, Dovetail |

### Later — AI bet, power-user depth, forward-looking

| # | Change | Surface(s) | Impact | Effort | Inspiration |
|---|---|---|---|---|---|
| L1 | **AI grounding surface: "Ask this matter" + case auto-summary + "Summarize this order" on documents.** The core product differentiator. | matter-detail, home, clients | high | L | product strategy |
| L2 | **CNR-driven eCourts autofill on new-matter** + sectioned new-matter form with "Save and create another". | matter-detail | high | L | product strategy, Jobber, Remote |
| L3 | **Rebuild Documents tab:** group by type, status pills, ⋯ menu, inline preview, Download all, drag-drop. | matter-detail | high | L | Origin, Gusto, Square |
| L4 | **Right-side create/edit slide-in panel for hearings/deadlines** from the Calendar; per-row actions (mark filed, adjourn). | calendar | high | L | Front, Amie, Skiff |
| L5 | **Tasks: List↔Board toggle with a kanban over `workflow_states`** + Display popover (group/sort/layout) + search + matter/client filter + task detail slide-over. | tasks | high | L | Linear, ClickUp, Todoist, Qatalog |
| L6 | **Matters power-user mode:** dense table view with column chooser + multi-select bulk-action bar + per-row kebab + pagination/virtualization. | matters-list | med | L | Attio, ClickUp, Zoho |
| L7 | **Inbox bulk select + clear-the-clutter**; Snoozed/Done as visible tabs. | inbox-triage | med | M | GitHub, Fibery |
| L8 | **Waitlist segmentation** (name + one qualifying question) + login affordances (eye toggle, keep-signed-in, inline field errors). | auth-onboarding | med | M | Amie, Behance, OpenAI |
| L9 | **Clients quick-add slide-over; intake into grouped sections that adapt to type** (GSTIN only for orgs) + format masks + duplicate detection. | clients | med | M | Front, Mercury, Apollo |
| L10 | **Forward-looking:** team/seats for small firms (scope as *access*, not associate task-assignment per STRATEGY.md); sidebar footer trial/monitoring status; first-run ghost-skeletons on list pages. | settings, design-system-nav | low–med | L | Copilot, Maze, Vercel |

---

## How to use this

- **Start every surface change from its report** — the galleries have the specific Mobbin references
  and the current-state line numbers.
- **Prefer shared primitives** for the cross-cutting themes (the time-horizon grouping component, the
  badge escalation, the EmptyState redesign, the save/toast/undo model) — they pay off across many
  surfaces at once and keep the dark theme coherent.
- **Sequence matters:** the Now bucket lands safety + shared foundations; Next consumes those
  foundations; Later is depth and the AI bet. Don't pull a Later item forward at the expense of the
  overdue-surfacing work in Now — that one is safety-critical for a litigation product.
