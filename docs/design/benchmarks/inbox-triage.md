# Inbox / triage — UX benchmark

Surface: the Inbox of `triage_items` — incoming court/case events that need the lawyer to act
(accept into a task, snooze, dismiss). Benchmarked 2026-06-22 against best-in-class web inbox/triage
products on Mobbin. Dark theme is treated as a fixed constraint; this benchmarks execution, not the
choice of dark.

---

## Current state (Legal Owl)

### What exists today

- **Single-column card list.** `inbox/page.tsx` renders a `max-w-3xl` centered column of cards, one
  per pending triage item, newest first (`page.tsx:46-50`). Each card is a `TriageRow`
  (`components/inbox/triage-row.tsx`).
- **Per-row content** (`triage-row.tsx:35-46`): a small kind chip (`order_uploaded` →
  "New order", etc., mapped in `page.tsx:12-16`), the summary as the primary line, and a muted
  matter link (`title · KEY` in mono).
- **Three inline actions per row** (`triage-row.tsx:48-71`): "Accept as task" (primary, opens a
  dialog), "Snooze" (outline, with a clock icon), "Dismiss" (ghost).
- **Accept flow** opens a modal `Dialog` (`triage-row.tsx:73-109`) with Priority `<select>` and a
  Due date input, then creates an `action` row via the `acceptTriageItem` server action
  (`actions.ts:15-55`) — it copies `summary` into the task title, links `resulting_action_id`, and
  flips the item to `accepted`.
- **Snooze is automatic/opinionated** (`actions.ts:67-96`): hides the item until the day before the
  matter's `next_hearing_date`, or +3 days if there is no hearing. No user choice of duration.
- **Dismiss** is a one-click state flip (`actions.ts:57-63`), no undo.
- **Empty state**: "Inbox zero / You're all caught up" via `EmptyState` (`page.tsx:43-44`).
- **Query** filters `state = pending` and un-snoozed (`page.tsx:22-28`).

### Strengths

- The **core triage verbs are right** (accept/snooze/dismiss) and map cleanly to the lawyer's job:
  turn a court signal into an actionable task or get it out of the way.
- **Accept-into-task with priority + due date** is genuinely good — it captures structured intent at
  the moment of triage, not later.
- **Snooze-until-day-before-hearing** is a smart, domain-aware default (the "deal with it just in
  time" persona note in `actions.ts:65`).
- Matter linkage gives every item context and a one-click jump to the case file.

### Concrete weaknesses

1. **No keyboard flow.** Triage is fundamentally a high-volume, repetitive task; every best-in-class
   inbox (Linear, Superhuman, Fibery, Height) is keyboard-first. Legal Owl is 100% mouse: every
   accept requires click → modal → two field interactions → submit.
2. **No detail / preview.** The card shows only a one-line `summary`. There is no way to see the
   underlying order text, the changed hearing date (old → new), the matter's status, or attachments
   without leaving the inbox for the matter page. The lawyer can't actually *evaluate* the item here.
3. **No grouping or filtering.** Everything is a flat newest-first list. No "today / this week",
   no grouping by matter or by kind, no "Unread/All" or kind filter. A lawyer with 30 pending items
   has no triage structure (compare GitHub "Group by: Date", Linear filters, ClickUp Important/Other).
4. **No snooze options.** Snooze is fully automatic with zero affordance to pick "tomorrow / next
   week / day before hearing / custom". Best-in-class always offers a menu (Linear, Front).
5. **No undo, no toasts.** Dismiss and snooze are silent and irreversible. Linear shows
   "Notification deleted — Undo"; the absence here is risky for a lawyer (dismissing a real court
   order with no recovery).
6. **No bulk actions / select-all.** GitHub and Workable both show checkboxes + "Select all" +
   "Mark as..." for clearing clutter. Legal Owl forces one-at-a-time.
7. **No counts / unread state.** No badge, no read/unread, no "X items left" progress — nothing tells
   the lawyer the size of the job or gives the satisfaction of clearing it.
8. **Kind chip is low-signal.** A lemon chip with text only; no icon, no severity/urgency coloring.
   A new court order vs. a status change should not look identical.
9. **Action buttons are heavy.** Three full-width-ish buttons wrap on every card
   (`flex flex-wrap gap-2`), creating a noisy, repetitive wall. Best-in-class hides actions until
   hover or moves them to a fixed action bar / keyboard.
10. **No "what changed" semantics.** For `hearing_date_changed` / `status_changed`, the inbox is the
    perfect place to show old→new diffs; today it's just a text summary string.

---

## Inspiration gallery

### Pattern A — Keyboard-first triage with a persistent action bar

**Linear — Inbox row actions menu**
([mobbin](https://mobbin.com/screens/040a46c9-be46-48c9-bfdd-77287da75a06))
- Right-click / context menu on a notification exposes **every triage verb with a single-key
  shortcut printed inline**: Mark as unread `U`, Snooze `H`, Status `S`, Assignee `A`, Priority `P`,
  Set due date `⇧D`, Delete. The shortcut hints *teach* the keyboard flow passively.
- The top bar has prev/next chevrons so you can fly down the list without touching the mouse.
- Why it works: triage becomes muscle memory. A lawyer clearing 20 items learns 3-4 keys and never
  opens a modal again.

**Fibery — Inbox split view with inline row actions + footer hint bar**
([mobbin](https://mobbin.com/flows/f2708eee-bd34-4832-9a1d-f7b4df7688dd))
- Left list / right detail. **Hovering a row reveals "Later" and "Done" buttons inline** on the row;
  the rest of the time the row is clean.
- A persistent **footer legend** spells out the keyboard map: "↑↓ navigate · ↵ move selected to
  today · L later · D done". This is the single best pattern for onboarding a keyboard flow.
- Tabs at top: **Do Today / Later / Done** — the inbox is split into temporal buckets, so snoozed
  ("Later") and processed ("Done") items have a home instead of vanishing.
- Why it works: zero learning cost (footer teaches), zero clutter (hover-reveal), and a clear mental
  model of where things go.

**Height — Inbox with Inbox/Unread/Mentions tabs**
([mobbin](https://mobbin.com/flows/e4e4c613-86fb-4457-8139-3b9e437ce964))
- Minimal three-tab segmentation (Inbox / Unread / Mentions) and a clean "You're all caught up!"
  empty state with a satisfying checkmark.
- Why it works: lightweight filtering without a heavy filter UI — exactly the right weight for a
  solo-lawyer inbox.

### Pattern B — Snooze as a quick menu of durations

**Linear — Snooze notification menu**
([mobbin](https://mobbin.com/screens/5f6d74d8-3dc6-4f6e-b0a7-944a9946353b))
- A compact popover: **An hour / Until tomorrow / Until next week / A month / Custom…**, each with a
  forward-arrow icon, triggered by `H`.
- Why it works: the most common durations are one tap; "Custom" covers the long tail. For Legal Owl
  the menu should include a domain-specific top option: **"Until day before next hearing"** (which is
  already the logic in `actions.ts:86-89`) plus generic durations.

**Front — Snooze with date+time picker and shared-inbox warning**
([mobbin](https://mobbin.com/screens/cf0e3b2a-6aaf-462c-8681-a86322ad4204))
- Snooze opens a date + time-of-day picker, with an explanatory line ("Your teammates will see this
  conversation as snoozed…"). Quick presets sit above an exact picker.
- Why it works: confidence — the user knows exactly when it will resurface. Good model for the
  "Custom…" branch of a Legal Owl snooze menu.

### Pattern C — Split view: list + full detail (evaluate without leaving)

**Front — list + full message + action bar**
([mobbin](https://mobbin.com/screens/42adf3bd-2dee-4f3b-82a8-bdec59a9556b))
- Three zones: a tight conversation list (with status pills like "Snoozed", VIP tags), the full
  message body, and a top action bar (Archive, snooze, assignee, tags). Left nav has **Open / Later /
  Done / Snoozed** as first-class states.
- Why it works: you read the actual content and act in one place. For Legal Owl the detail pane is
  where the *order text / hearing diff / matter status* should live.

**Intercom — list + conversation + structured Details sidebar**
([mobbin](https://mobbin.com/screens/cb52a9cc-362d-4657-8fd3-ae43f0e2ceb5))
- Three-pane: list, conversation, and a **Details rail** with Assignee, Team, Linking, Ticket type,
  Lead data — structured metadata next to the thread, plus "⌘K for shortcuts" hint in the composer.
- Why it works: the structured rail is exactly the shape Legal Owl needs — Matter, CNR, next hearing,
  status, linked documents — so the lawyer triages with full case context visible.

**Lemni — inbox + email + AI-summarized Details rail**
([mobbin](https://mobbin.com/screens/f88a274b-d678-429b-9e2d-52639c530dc4))
- Detail rail includes a **"Summary" field** and a Status/Priority/Assigned block, with a one-click
  "Send Email" primary action and a subtle "Alex approved" inline confirmation.
- Why it works: the AI summary + structured fields let you decide at a glance — directly analogous to
  Legal Owl summarizing a court order in the rail.

### Pattern D — Bulk clearing & "clear the clutter"

**GitHub — Notifications inbox with select-all and bulk actions**
([mobbin](https://mobbin.com/screens/2e7cf2ed-0d26-4544-93c4-4a7b6cba2e8d))
- **Select-all checkbox**, per-row check + an X (done) on hover, **"Group by: Date"**, an
  Unread/All filter, and a literal "Clear out the clutter / mark all as read" promo card. Sidebar
  has Inbox / Saved / Done plus filters (Assigned, Mentioned, Review requested).
- Why it works: high-volume clearing in two clicks. A lawyer returning after a week of court updates
  can bulk-dismiss noise and keep the real orders.

**Workable — checkbox list with per-row contextual primary action**
([mobbin](https://mobbin.com/screens/2146514d-1011-4f03-8b62-cef4040e0c42))
- Every row carries a **single contextual CTA matched to the item type** ("Sign document", "View
  profile", "Go to reviews", "Approve") plus a small leading type icon. Bulk select + "Mark as…"
  with a "7 items marked as read" toast.
- Why it works: the right action per kind. Legal Owl could do the same — "Accept as task" for an
  order, "Update hearing" for a date change, "Review" for a status change.

### Pattern E — Counts, progress, and a calm empty state

**Linear — unread count + "Notification deleted · Undo" toast**
([mobbin](https://mobbin.com/screens/8337813e-f0dd-4415-8a29-87c114b0442b) ·
[undo toast](https://mobbin.com/screens/14cbb61d-2120-46fa-b29c-b7678e4b85cc))
- Sidebar shows an unread count; processed items show inline state ("Snoozed for 1d"); deleting fires
  a bottom toast with **Undo**.
- Why it works: reversibility + visible progress. Critical for a lawyer who must never lose a real
  order to a misclick.

**Fibery — "Your inbox is empty, signalling a temporary calm" empty state**
([mobbin](https://mobbin.com/flows/ad18111a-752e-42e3-92d3-5a1efa40d308))
- A warm, human empty-state line plus a hint to manage via Do Today / Later / Done states.
- Why it works: rewards inbox-zero and reinforces the triage model. A better line than Legal Owl's
  plain "You're all caught up."

---

## Gaps vs. best-in-class

| Capability | Best-in-class | Legal Owl today |
|---|---|---|
| Keyboard triage (j/k nav, e/h/x verbs) | Linear, Fibery, Height | None |
| Footer/legend teaching shortcuts | Fibery | None |
| Detail/preview pane (read before acting) | Front, Intercom, Lemni | None — one-line summary only |
| Snooze duration menu | Linear, Front | Fully automatic, no choice |
| Undo / toasts on destructive actions | Linear, Workable | None — silent & irreversible |
| Bulk select + clear | GitHub, Workable | None |
| Grouping (date/matter) & filters | GitHub, ClickUp, Linear | Flat newest-first list |
| Unread count / progress | Linear | None |
| Per-kind icon + contextual CTA | Workable | Generic chip + same 3 buttons |
| Snoozed/Done as visible states | Front, Fibery | Snoozed items just disappear |
| What-changed diffs (hearing old→new) | (domain-specific) | Plain text summary |

---

## Recommendations

Prioritized. Impact/effort noted; inspiration cited.

1. **Add a keyboard-driven triage flow with a footer legend.** (Impact: high · Effort: M ·
   Linear + Fibery) — `j/k` (or ↑↓) to move a selection highlight down the list, `e` accept,
   `h` snooze, `x` dismiss, `↵` open matter. Render a persistent bottom legend bar:
   "↑↓ navigate · E accept · H snooze · X dismiss". This is the single biggest lever — it turns
   triage from a click-marathon into a flow. Implement with a client list wrapper holding selected
   index + a `keydown` handler calling the existing server actions.

2. **Introduce a split list+detail layout.** (Impact: high · Effort: L · Front/Intercom/Lemni) —
   Replace the centered single column with a two-pane layout: a tight row list on the left, a detail
   pane on the right showing the full event (order text / hearing **old → new** / status change),
   plus a structured rail: Matter title + KEY/CNR, current status, next hearing, linked documents.
   The lawyer evaluates and acts without leaving. On narrow screens, collapse to the current
   single-column (row → expandable).

3. **Make snooze a duration menu with a domain default.** (Impact: high · Effort: S · Linear/Front)
   — Replace the one-click auto-snooze with a popover: **"Until day before next hearing"** (current
   logic, shown as the top/default option), Tomorrow, Next week, Custom… (date+time picker). Keep the
   smart hearing-aware default as the highlighted first item. Show the resolved date inline
   ("Snoozed until 14-Jul") after action.

4. **Add undo toasts on dismiss and snooze.** (Impact: high · Effort: S · Linear) — On every
   destructive/state action fire a toast "Dismissed · Undo" / "Snoozed until 14-Jul · Undo" with a
   ~6s window that reverts the state flip. For a lawyer, accidentally burying a real court order with
   no recovery is the scariest failure mode in this surface. Requires keeping prior state to restore.

5. **Per-kind icon + severity color + contextual primary action.** (Impact: med · Effort: M ·
   Workable) — Give each `kind` a leading icon and a color (new order = attention/lemon, hearing
   change = warning, status change = neutral). Match the primary CTA to the kind: order → "Accept as
   task", hearing change → "Update hearing", status change → "Mark reviewed". Make secondary actions
   hover-reveal to de-noise the list (`triage-row.tsx:48-71`).

6. **Group the list (Today / This week / Older) and add lightweight filters.** (Impact: med ·
   Effort: M · GitHub/ClickUp/Linear) — Add date-group headers and a small filter row
   (All / by kind / by matter). Helps a lawyer impose order on a backlog after a busy court week.

7. **Bulk select + "Mark all reviewed / dismiss selected".** (Impact: med · Effort: M ·
   GitHub/Workable) — Add row checkboxes, a select-all, and a bulk action bar. Returning after time
   away, the lawyer can clear noise in two clicks instead of N.

8. **Show counts and processed states.** (Impact: med · Effort: S · Linear) — Add an unread/pending
   count to the Inbox nav item and the page header ("8 to review"). Optionally surface Snoozed and
   Done tabs (Front/Fibery) so snoozed items are inspectable, not invisible.

---

## Quick wins

1. **Snooze duration menu** — swap the silent auto-snooze for a popover with the hearing-aware
   default on top + Tomorrow / Next week / Custom (rec #3). Small change, large daily payoff.
   (Linear/Front)
2. **Undo toast on dismiss & snooze** — wrap the existing actions with a restore + toast (rec #4).
   Removes the scariest failure mode. (Linear)
3. **Pending count in header + nav** — `page.tsx` already fetches the list; render `items.length`
   as "N to review" and badge the nav. (Linear)
4. **Per-kind leading icon + color** on the chip in `triage-row.tsx:37-39` so a new order reads
   differently from a status change at a glance. (Workable)
5. **Warmer empty state + keyboard legend stub** — replace "You're all caught up" with a calmer line
   and, even before full keyboard support, show a footer hint bar to seed the model. (Fibery)
