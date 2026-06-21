---
date: 2026-06-21
topic: frontend-design-learnings
status: design source of truth — §0 is the v1 build spec
method: 9-lane UI/UX research (Linear, Superhuman, Harvey, Clio, Attio, Vercel, Provakil, …) + synthesis + anti-slop/scope curation
related: docs/specs/case-workflow.md
---

# Legal Owl — Frontend Design Learnings

UI/UX learnings for the Case Workflow frontend, grounded in real reference apps (Mobbin-style;
Mobbin itself is login-gated, so this studies the apps it catalogs).

> **How to read this:** **§0 is the locked v1 — build to it.** §1–§6 is the full reference research
> (the "v3 vision"). §7 is the curation that trimmed it. Where they conflict, **§0/§7 win** — the raw
> synthesis over-specified for a first build.
>
> **Auth override:** the research recommended OTP-first auth. We chose **email/password + a waitlist
> access gate** (already built — `app/login`, `app/waitlist`, `has_access`). Ignore the research's OTP
> sections; keep everything else.

---

## 0. Locked for v1 (the build spec)

### 6 decisions locked
1. **One accent, one saturated semantic hue.** Neutral everything; **court-event blue is the only
   saturated color in the timeline**; urgency uses a single warm red reserved strictly for
   today/overdue. Kills the violet-AI / indigo-accent / blue-court collision. This is the main thing
   separating us from template-SaaS.
2. **Light-only, single density, mobile-derived spacing.** Tokens *named* so dark mode + a density
   toggle are later swaps — but build one of each now.
3. **Contrast floor for the urgent layer (glare-first).** 14px minimum body; **solid fills, not tints,
   for today/overdue**; the next-hearing date is the highest-contrast element on any row. The persona
   reads this in sunlight on a mid-range Android.
4. **Zero-typing core loop.** Triage Accept = one tap (typed input optional, never required); every
   function reachable without Cmd+K; matter short-name auto-derived from CNR parties, never a creation
   blocker.
5. **AI is a quiet clerk — two states, not three.** `Grounded — with citation` vs `No source found —
   manual entry`. Keep the subtle provenance tint. No third badge, no gavel iconography, no
   palette-AI in v1. Abstention = simply showing no suggestion.
6. **Timeline is flat in v1.** Two-tier visual weight (system event = compact line, lawyer remark =
   bordered card) + source chip + absolute dates for court events. No collapse, no draggable snap
   sheet, no peek panel.

### v1 scope (≈⅓ of the research)
Tokens (light) + status/identity atoms → app shell (sidebar + bottom nav + TopBar, Cmd+K nav/create
only) → Matter list → Matter detail + flat timeline → Triage inbox (buttons, not swipe) → Home/Today
→ Action list (no board) → **one** AI surface (triage suggestion chip with reasoning + abstention).

### Build order (frontend-first, mock data, mobile-first)
1. **Tokens + atoms** — `StatusIcon`, `StatusBadge`, `HearingPill`, `CNRChip`, `SourceChip`. Prove the
   "legal ledger" look on one static page before any screen.
2. **App shell** — sidebar + bottom nav + TopBar + Cmd+K (navigate/create only), routing on mock JSON.
3. **Matter list** — next-hearing sort, 2-line names, glare-tested urgency.
4. **Matter detail + flat unified timeline + pinned strip + last-synced indicator** (the trust artifact).
5. **Triage inbox** — sectioned list + Accept/Dismiss/Snooze **buttons** + one-tap accept slide-up +
   undo toast + the "day before hearing" snooze.
6. **Home / Today** — composition of existing atoms.
7. **Action list** (list only).
8. **One AI surface** — triage suggestion chip.

### Deferred to v2+ (research scope, not build scope)
Action board + swimlanes, Peek panel, dark mode, density toggle, swipe card-stack triage + haptics,
draggable bottom-sheet, consecutive-event collapse, the AI drawer + citations + source-passage drawer +
@-doc scoping, command-palette AI mode, public client-status share URL + WhatsApp deep-link,
case-law verification tags.

---

## 1. Design direction (reference)

- **Feel: a calm legal ledger, not a startup dashboard** — reads like a well-typeset court record
  (neutrals, 1px rules, tabular numerals, status by icon-shape-then-color). Trust is the retention driver.
- **Most channeled:** **Linear** (~70% of the interaction model: status-type abstraction, Triage, Cmd+K,
  list density, OKLCH theming), **Superhuman** (triage speed: one-item decisions, keyboard verbs,
  optimistic+undo), **Harvey** (AI trust: inline citations, abstention, approve-before-act), **Clio /
  Smokeball** (pinned matter-header + unified timeline over tab-fragmented views).
- **Mobile is co-primary** — Triage + Timeline designed mobile-first; desktop adds density, not features.
- **Not doing:** metric-soup KPI home; floating AI orb; gradients/glassmorphism/gradient-text; horizontal
  kanban on mobile; alphabetical matter lists; AI output without a citation-or-abstention.

## 2. Visual language — Tailwind v4 + shadcn tokens (reference; apply the §0/§7 color simplification)

**Type:** Geist Sans + Geist Mono (CNRs in mono) + Noto Sans Devanagari for vernacular. `tabular-nums`
on all dates/counts/CNRs. Dates always `dd-MMM` (e.g. `24-Jun`) to kill dd/mm ambiguity. *(§7: consider a
humanist/transitional serif for party names only — Geist alone is itself a 2025 slop tell.)*

Type scale (4-step, Vercel/Stripe restraint): `text-xs` 12/400 metadata · `text-sm` 13/400 body *(→ 14
min per §0.3)* · `text-base` 14/500 row titles · `text-lg` 16/600 page titles · `text-display` 24/600
empty states.

**Spacing:** 4px grid. Ship one density (comfortable, mobile-derived; row ~44–48px). Min touch target 48px.

**Color (OKLCH, map into `globals.css` `:root`/`.dark`):**
```css
--color-canvas:  oklch(0.985 0 0);   /* consider a faint warm paper tone to de-SaaS (§7) */
--color-surface: oklch(1 0 0);
--color-border:  oklch(0.88 0 0);    /* §7: too faint for glare on urgent rows — strengthen there */
--color-muted-fg:oklch(0.55 0.01 260);
--color-accent:  oklch(0.52 0.16 250);     /* single neutral-ish accent: primary buttons + focus */
--color-source-court:  oklch(0.52 0.18 240); /* the ONLY saturated hue in the timeline (§0.1) */
--color-urgent-today:  oklch(0.55 0.22 25);  /* the ONLY warm red: today/overdue, solid fill */
--color-urgent-week:   oklch(0.79 0.13 85);  /* amber: ≤7 days */
/* status-types as muted NEUTRAL icon shapes; reserve saturation for court + urgency only */
```
Status legal labels (name layer over the 6 types): Triage→"Awaiting Review", Unstarted→"Pending",
Started→"In Progress", Blocked→"Blocked", Completed→"Disposed", Cancelled→"Dropped". **Status = icon
shape + muted tint, not loud pills.** Triage = amber (attention), AI uncertainty = amber/grey, **never
red** (red = legal danger).

**Borders/shadows:** 1px borders inline (shadow-as-border, Vercel); shadows only on floating layers
(modal, palette, popover). Radius 8px (`rounded-lg`) — document-precise, not bubbly.
**Motion:** 150ms fast / 300ms base, ease-out; skeletons never spinners; respect `prefers-reduced-motion`;
never animate route transitions or row reorders.

## 3. IA & navigation (reference)

- **Desktop:** inverted-L — 220px sidebar (collapsible to 48px, dimmed) with Today / Triage(badge) /
  Matters / Actions / Settings; 40px top bar (section + primary action).
- **Mobile:** 5-tab bottom nav (Home / Matters / Triage(badge) / Actions / Search), hides on scroll;
  context FAB.
- **Cmd+K** (Linear/Raycast): fuzzy over matters (party name, short name, **CNR — match last-4**),
  actions, hearings, commands. v1 = navigate + quick-create only (`A` new Action, `H` new Hearing).
- **Screen map:** Auth → Home (Today) → {Matters → Matter detail (Timeline | Documents | Actions +
  later AI drawer), Triage, Actions}.

## 4. Per-screen design (reference, condensed)

- **Home / Today** — pure scroll, urgency tiers top→bottom: Today's Hearings (time-anchored, court-tier
  left border) → amber Triage callout (`3 new court events need review`) → Due Today/This Week → Blocked
  → This Week (collapsed). No charts. Empty sections hidden (except keep the Hearings header on mobile).
- **Matter list** — dense rows, **default sort next-hearing asc** (no-hearing matters muted at bottom);
  row = status icon + **short name (wrap 2 lines, never truncate Indian names)** + client muted +
  next-hearing pill + action count + CNR mono. Mobile = cards. *(Peek panel deferred.)*
- **Matter detail** — sticky **pinned-fields strip** (short+full name, CNR copyable, status, **next
  hearing bold/red if ≤3d**, action count, inline-edit optimistic) + **last-synced indicator** (§7) +
  tabs Timeline | Documents | Actions + collapsible property sidebar (cap ~12 fields).
- **Unified timeline** (primary artifact) — pinned amber Next-Hearing anchor card above the feed;
  **two-tier weight** (system event = compact muted line w/ 3px dot; lawyer remark = bordered card w/
  avatar); **source chip on every entry** (court=blue, lawyer=neutral, AI=violet+pending-amber); sticky
  day dividers; **absolute dates for court events** (relative only as muted secondary). Mobile = scroll
  page (snap-sheet deferred). Add-remark = one tap.
- **Triage inbox** — sections Urgent → This Week → Older (by hearing date, not fetch time); verbs
  **Accept (→ pre-filled Action slide-up) / Dismiss (→ timeline read-only) / Snooze** with
  **"day before hearing"** (the standout feature); optimistic + 5s undo toast naming the matter; never
  auto-accept. v1 = buttons (swipe deferred).
- **Action list** — status icon + verb-phrase title + matter muted + due badge + hearing-link. (Board +
  swimlanes deferred.)

## 5. AI surfacing (reference; v1 = one surface, two states)

v1: **the triage suggestion chip only** — same pill style as human metadata
(`Suggested: Attach to Matter — … [CNR …]`), hover reveals one-line reasoning, Accept/Dismiss, **no chip
when unsure** (explicit abstention). Two grounding states: `Grounded — with citation` /
`No source found — manual entry`. Subtle ~2–3% provenance tint on AI-written fields. Approve-before-act on
anything outbound. *(Deferred: matter-detail AI drawer with inline citations + source-passage drawer,
AI summary block, draft diff cards, palette-AI.)*

## 6. Component inventory (reference)

**shadcn base (installed):** Button, Input, Badge, Tooltip, Popover, Command, Dialog, Sheet, Collapsible,
Tabs, Avatar, Separator, Skeleton, Sonner, ToggleGroup, ScrollArea, Calendar/DatePicker.
**Custom atoms (build first):** `StatusIcon` (6 shapes), `StatusBadge`, `HearingPill`, `DueDateBadge`,
`CNRChip` (mono+copy), `SourceChip`, `CourtTierBorder`.
**Nav:** `AppSidebar`, `BottomNav`, `ContextFAB`, `CommandPalette`, `TopBar`.
**List/detail:** `MatterRow`/`MatterCard`, `PinnedFieldsStrip`, `PropertyGroup`, `InlineEditField`,
`ActionRow`.
**Timeline:** `Timeline`, `TimelineSystemEvent`, `TimelineRemarkCard`, `DayDivider`, `NextHearingAnchor`,
`AddRemarkInline`.
**Triage:** `TriageQueue`, `TriageRow`, `TriageDetailPanel`, `AcceptActionSlideUp`, `SnoozeMenu`,
`UndoToast`, `TriageSuggestionChip` (the one AI surface).
**States:** `EmptyState`, `SkeletonList`/`SkeletonTimeline`.
*(Deferred components: Peek, board/swimlane, AIDrawer/CitationRef/SourcePassageDrawer/AIDiffCard,
PublicCaseStatusView, swipe `TriageCardStack`, `DensityToggle`.)*

---

## 7. Curation — anti-slop, scope, persona-fit (these corrections win)

**Anti-slop:**
- The neutral+indigo+OKLCH+Geist+skeleton+Cmd+K stack *is* the 2025 "tasteful AI startup" uniform —
  faithfully cloning Linear/Attio is still a clone. Need ≥1 unmistakably *this-product* element.
- **Collapse the color soup:** ~9 semantic colors (6 status + 4 source + 3 urgency, all cool blues)
  read as one smear. **Court-blue is the only saturated timeline hue; one warm red for urgency;
  everything else neutral** (locked §0.1).
- Make "legal ledger" real, not asserted: ruled-line tables, register feel, **case-number-as-hero**
  typography, a faint **warm paper canvas** instead of pure white.
- Don't over-label AI (three badges + tint + superscripts = "Powered by AI" sticker). Two states + the
  subtle tint. **No gavel iconography** (the legal equivalent of a purple gradient).

**Persona fit (corrections):**
- **Zero-typing:** Accept must need no text (Action Type defaulted/optional); nothing palette-only —
  bottom-nav+tap must fully suffice.
- **Auto-derive matter short-name** from CNR parties (`Sharma v. State`), editable later — never block
  creation on naming.
- **Don't truncate Indian names:** action titles should be verb-phrases ("File reply"), not party
  names; 2-line clamp where names appear.
- **Glare-first urgency:** 14px min body, **solid fills for today/overdue**, next-hearing date the
  highest-contrast element; 1px `oklch(0.88)` borders + 13px gray text vanish in sun.
- **Dates over countdowns** for anything hearing-related (`24-Jun · in 2d`, never relative-only).
- **Connectivity:** "between courtrooms" = *no* signal. Add a **last-synced indicator** on the pinned
  strip + Today header so the lawyer knows if the screen is current. Trust product ⇒ "is this current?"
  is first-class.
- **Keep & feature "Snooze → day before hearing"** — the one feature unmistakably built for this user.

**One-line verdict:** the thinking is right, the *quantity* is wrong for a first build, and the
color/type choices are one honest pass from the very slop the doc swears off — cut to the §0 v1, commit
to a genuinely legal (not Linear-cloned) identity, and design the urgent layer for sunlight.
