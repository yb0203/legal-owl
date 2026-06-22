# Design system, navigation & theme (cross-cutting) — UX benchmark

_Surface owner: cross-cutting (sidebar nav, page-header, badge system, empty states, off-dark mint/lemon theme, typography, command palette, toasts). Benchmark date: 2026-06-22. The dark theme is a deliberate, fixed product choice — this doc benchmarks **execution quality**, not the choice to be dark._

## Current state (Legal Owl)

### What exists today

**Navigation — `components/app-sidebar.tsx`**
- A single flat `NAV` array of 7 items (Home, Calendar, Matters, Inbox, Tasks, Clients, Settings) rendered as one `SidebarGroup` (lines 37–45, 64–81). Each item is icon + label; active state via `pathname === href || pathname.startsWith(href + "/")` (line 67).
- Inbox has a count `SidebarMenuBadge` when `inboxCount > 0` (lines 74–76). No other item carries live counts.
- Footer is a user-identity dropdown: avatar with email initials, truncated email, `ChevronsUpDown`, and a menu with Settings + Sign out (lines 84–116). There is **no workspace/org switcher** and no quick "New" entry point in the sidebar.
- Sign-out is implemented via a hidden form + `requestSubmit()` (lines 85, 106–109) — works but is a small hack.

**Top bar — `components/app-header.tsx`**
- Sticky 56px header with `SidebarTrigger`, a serif page title derived from the path (`titleFor`, lines 26–34), and right-aligned `CommandPalette` + a "New" dropdown (matter / client).
- The header title **duplicates** the `PageHeader` title rendered inside each page (`page-header.tsx`), so most authenticated pages show the page name twice.

**Page scaffolding — `components/page-header.tsx`**
- `PageHeader`: serif `text-2xl` title, optional muted subtitle, right-aligned actions slot (lines 5–25).
- `SectionCard`: bordered `rounded-xl` card with optional header row (lines 27–49).
- `EmptyState`: dashed-border box, title + hint + optional action — **text only, no illustration, no icon** (lines 51–67).
- `Stat`: serif `text-3xl` number + muted label, optional link + `urgent` tone (lines 69–99).

**Status / badge system — `components/badges.tsx`**
- `StatusBadge`: shape-then-color system — each `StateType` gets a distinct lucide glyph AND hue (triage=Inbox/lemon, started=CircleDot/primary, blocked=CircleSlash/urgent, etc., lines 25–32). Genuinely thoughtful: survives colour-blindness and renders at a glance. Completed/cancelled labels dim to muted (line 47).
- `PriorityBadge` (text-only tone ramp), `DueDateBadge` (overdue = solid urgent fill, today = urgent tint, else muted — strong signal hierarchy, lines 71–93), `HearingPill`, `CNRChip` (mono), `ForumBadge`, `SourceChip` (eCourts vs You). Tabular-nums (`tnum`) applied to dates/numbers consistently.

**Theme — `app/globals.css`**
- Off-dark slate background `oklch(0.235 0.014 282)` (never pure black), warm off-white text, pastel mint primary `oklch(0.82 0.12 142)`, pastel lemon accent, urgent red. `--radius: 1rem` (large, soft). `:root` and `.dark` carry identical values (lines 71–168) so there is effectively one theme.
- One signature flourish: the animated `owl-ring` conic gradient (lines 186–209), reduced-motion-aware.
- Shadows are heavy (`0px 10px 25px / 0.36`) — designed for a light UI; on a dark surface large soft shadows mostly read as nothing.

**Command palette — `components/command-palette.tsx`**
- cmdk via shadcn `CommandDialog`. ⌘K toggle (lines 44–53). Groups: Create, Go to (nav), Matters (when provided). Trigger is a faux search input in the header with a ⌘K kbd hint (lines 62–72). Solid baseline but: no recent items, no per-row keyboard shortcut hints, no actions beyond navigation (can't change status, add hearing, jump to a client), and the dialog is navigation-only.

**Toasts — `components/ui/sonner.tsx`**
- Sonner wired to theme tokens with success/info/warning/error/loading icons. Good baseline; no documented usage patterns (action buttons, undo, promise toasts).

### Strengths
- The **shape+color StatusBadge** is best-in-class thinking — most apps rely on color alone.
- **DueDateBadge urgency ramp** (solid red overdue → tinted today → muted) is exactly the right signal hierarchy for a deadline-driven legal tool.
- Coherent token system, tabular numerals everywhere, mono for case numbers/CNRs — the typographic intent (Geist / Geist Mono / Source Serif 4) is sound.
- Off-dark palette is comfortable and distinctive; the owl-ring is a tasteful brand moment.

### Concrete weaknesses
1. **Duplicated title** between `app-header.tsx` and `PageHeader` — the page name appears twice on nearly every screen.
2. **Flat nav with no grouping** — 7 peers with no sense of "what's urgent today" vs "reference." Only Inbox shows a count; Tasks/Calendar (the time-sensitive items) do not.
3. **Empty states are text-in-a-dashed-box** — no icon/illustration, generic copy, often no primary CTA. This is the weakest visible part of the system.
4. **No org/workspace context** in the sidebar; the footer is identity-only.
5. **Command palette is shallow** — navigation only, no recents, no inline shortcut hints, no contextual actions.
6. **Shadow tokens are tuned for light UI** and contribute little on dark; depth is carried almost entirely by `--border`, which is fairly low-contrast.
7. **Header `titleFor` is a duplicate source of truth** for route titles, separate from the nav array and command palette — three places list the same routes.

---

## Inspiration gallery

### Sidebar navigation & workspace context

**Linear** — [issues sidebar with grouped nav](https://mobbin.com/screens/815793b1-5c75-43ac-94c7-93380781e337)
- Nav is **grouped with quiet section labels** ("Workspace", "Your teams") and a pinned Inbox/My-issues block at top. This separates "my immediate work" from "structural navigation" — exactly the Home/Inbox/Tasks vs Matters/Clients/Settings split Legal Owl lacks.
- Active row is a subtle filled pill, not a heavy highlight — restraint that reads well on dark.
- Icons are 16px, low-chroma; the eye lands on labels, not a rainbow of icons.

**Cycle** — [Home with quiet sidebar + quick actions](https://mobbin.com/screens/69bc1766-9272-42a5-80c8-aaa3a3bb0b99)
- Sidebar separates "Views" (Discovery, Insights) from primary nav, and the **footer carries plan/usage** ("3 of 25 created") rather than just identity — a model for surfacing trial/usage state.
- The Home body opens with a personalized "Hey, Jane" + a "Quick actions" row of create buttons — a far warmer landing than a bare title.

**Vercel** — [projects overview, dark](https://mobbin.com/screens/9b397b77-fd80-4157-9867-2ae4010133a4)
- Reference-grade dark execution: near-black canvas, cards one step lighter, **borders doing the depth work** (no fake shadows) — validates dropping Legal Owl's light-tuned shadow tokens.
- The footer carries an **"Action Required" alert block** and an account row with org avatar — a richer, more useful sidebar foot than identity-only.
- A persistent "Find…" field with an `F` hint sits at the very top of the sidebar (command entry built into nav).

**Asana / Webflow** — [Asana left nav with Insights + Starred + Projects groups](https://mobbin.com/screens/50d6e913-32d8-4a21-a4db-d44715e6ceaa) · [Webflow workspace switcher](https://mobbin.com/screens/e6ef30e7-d8d2-450f-b039-1fd1ccc0bdd3)
- Asana groups nav into Insights / Starred / Projects / Team and uses a **bottom trial-status pill + "Invite teammates"** — pattern for Legal Owl's waitlist/trial context.
- Webflow shows a clean **workspace switcher** at the top of a Settings-grouped sidebar (General/Team/Plans/Billing) — a tidy model if Legal Owl ever adds multi-firm or assistant seats.

### Dark-theme execution & typographic hierarchy

**Linear** — [dark issue list with status + priority + labels](https://mobbin.com/screens/e142df2a-3527-499c-8f81-1b715947ac0c)
- The gold standard for **status iconography**: each workflow state is a distinct circle glyph with a state hue, identical in spirit to Legal Owl's `StatusBadge` — confirms the approach and shows the target polish (consistent 16px, sub-grouped by state with counts in the group header).
- **Colored pill labels** ("Research", "UX", "Feature") are low-saturation chips with a leading dot — a template for matter tags / forum chips that's calmer than filled badges.
- Dense rows with tabular dates right-aligned; the priority bar-chart glyph encodes priority in shape, not just color.

**Fey** — [command/onboarding on near-black with gradient headline](https://mobbin.com/screens/ff52ac90-4d18-4765-98da-df1e362a5ee1)
- Masterclass in **opinionated dark + restrained accent**: a single gradient on the headline, everything else monochrome — depth from layered translucency, not shadow. Per-row shortcut chips (X/A/F/I/E) on the right edge are crisp and legible.
- Validates Legal Owl using mint/lemon as rare accents, not as fills everywhere.

**Posh** — [dark data table](https://mobbin.com/screens/76ac6fa5-f94c-446f-9240-5298de77848f)
- Pure-monochrome dark table with hairline row separators and right-aligned numerics — shows how far you get on dark with **just type weight + alignment + borders**, no chrome.

**Zoho CRM** — [dark CRM dashboard](https://mobbin.com/screens/9bc4fa4c-2460-4b34-9a12-a8cc9a5e3d42)
- A counter-example worth studying: same idea as Legal Owl (nav + stat cards + tables on dark) but muddier — borders too low-contrast, accents over-used. Reinforces that **border contrast and disciplined accent use** are the difference between premium and generic dark.

### Command palette (⌘K)

**Linear** — [command menu with per-row shortcuts](https://mobbin.com/screens/8a6d227b-63e6-483c-925f-d256d0989a10)
- Shows a **context chip** ("Issue - JOH-1 …") above the input, so the palette acts on the current object, and **every row has its keyboard shortcut** on the right (A, I, S, P, L). This is the action-oriented palette Legal Owl is missing (Change status, Add hearing, Assign).

**Vapi** — [dark command palette grouped Actions / Recent / All Pages](https://mobbin.com/screens/593d7acd-2e16-4365-bcd6-02ce52f48f3b)
- Dark palette with a **Recent group** and a footer legend ("↑↓ to navigate · ↵ to select · 14 results"). The Recent group + footer hint are two concrete adds for Legal Owl.

**Juicebox** — [palette with section navigation hint](https://mobbin.com/screens/2af813bf-0129-45d1-81ed-069edee76e16)
- Footer shows "Tab to jump sections" and per-row "open in new" affordances — teaches power-use inside the palette itself.

**StackAI** — [palette listing destinations with descriptions](https://mobbin.com/screens/bbcc94bb-f535-4dca-8532-56b135fce5c3)
- Each destination has a **one-line description** under the label ("Overview of all your projects and analytics") — useful for ambiguous legal nav (what's "Inbox" vs "Tasks"?).

### Empty states

**Linear** — [Projects empty state](https://mobbin.com/screens/6fec9045-5cd5-4882-b9e9-97afac29616e)
- Centered **line-art icon (isometric boxes)** + bold title + a two-paragraph explanation of _what the concept is and why it matters_ + primary "New project" and secondary "Documentation" buttons. This is the template: educate, don't just say "nothing here."

**Todoist** — [Projects empty state](https://mobbin.com/screens/3969d9e3-e2d9-419b-855f-ece7a08a9e0f) · [no-results search state](https://mobbin.com/screens/f5d20fdd-480d-472c-a38d-d54f3050693a)
- Warm illustration + benefit-led copy ("Keep your tasks organized in projects") + a help link, and a **distinct "No projects found / try adjusting your search"** state — proves empty (nothing yet) and empty (filtered to nothing) deserve different copy/CTAs.

**Jira / ClickUp** — [Jira board empty state](https://mobbin.com/screens/a875093c-9fb7-4927-b841-70a1e92a7463) · [ClickUp empty list skeleton](https://mobbin.com/screens/70f13c0c-a8eb-4e38-b0fd-9462abbef1a7)
- Jira pairs an illustration with "Visualize your work with a board" + one CTA. ClickUp shows a **ghosted skeleton of the eventual content** ("This Space is empty. Create a List") — a nice way to preview structure for first-run Matters/Tasks.

---

## Gaps vs. best-in-class

1. **Flat nav vs. grouped nav (Linear, Asana, Cycle).** Legal Owl gives 7 equal peers; best-in-class separates "my work now" from "reference/admin." A lawyer scanning at 9am wants today's hearings/tasks to be visually first-class.
2. **Identity-only footer vs. context-rich footer (Vercel, Asana, Cycle).** No trial/waitlist status, no org context, no usage. Given the `has_access` waitlist gate, the footer is a wasted slot for status.
3. **Counts only on Inbox vs. counts across time-sensitive nav (Linear).** Tasks-due-today and today's-hearings carry no glance-able badge.
4. **Text-only empty states vs. educational illustrated ones (Linear, Todoist, Jira).** The single biggest visible quality gap. No icon, no "what is a Matter and why," no distinction between never-created and filtered-empty.
5. **Navigation-only ⌘K vs. action palette (Linear, Vapi, Juicebox).** No recents, no per-row shortcuts, no contextual actions, no footer legend.
6. **Light-tuned shadows + low-contrast borders vs. border-driven dark depth (Vercel, Fey).** Depth currently relies on near-invisible shadows; Vercel/Fey get crisp hierarchy from border contrast + layered surfaces.
7. **Duplicated page title (header + PageHeader)** — no best-in-class app shows its page name twice; Linear/Vercel put breadcrumb-or-title in exactly one place and use the freed bar for context/actions.

---

## Recommendations

1. **Group the sidebar into 2–3 labelled sections.** "Today" (Home, Inbox, Tasks, Calendar) and "Case files" (Matters, Clients), with Settings pinned to the footer. Use Linear-style quiet uppercase group labels. _Why:_ a deadline-driven solo lawyer should see time-sensitive items as a distinct cluster. _Impact: high · Effort: S._ _From Linear/Asana/Cycle._

2. **Redesign `EmptyState` to be illustrated + educational.** Add an `icon`/illustration slot (lucide line-art is enough), keep title, expand `hint` to 1–2 sentences of "what this is + why it helps," support a primary + secondary action, and add a `variant="no-results"` for filtered-empty with different copy ("No matters match — clear filters"). _Why:_ first-run lawyers need to understand Matter→Action; empty screens are teaching moments. _Impact: high · Effort: M._ _From Linear/Todoist/Jira._

3. **Make the ⌘K palette action-oriented.** Add a Recent group (recently opened matters/clients via localStorage), a footer legend ("↑↓ navigate · ↵ open · Esc close"), per-row shortcut hints, and contextual actions when on a matter ("Add hearing", "Change status", "Log remark"). _Why:_ lawyers live in a few active matters; jump-and-act beats click-trees. _Impact: high · Effort: M._ _From Linear/Vapi/Juicebox._

4. **Kill the duplicate title.** Have `app-header.tsx` render breadcrumb/context (e.g. `Matters / Sharma v. State`) OR nothing, and let `PageHeader` own the H1. Reclaim the bar for global search + New + (later) notifications. _Why:_ removes visual redundancy, frees the most valuable horizontal strip. _Impact: med · Effort: S._ _From Vercel/Linear._

5. **Add live counts to time-sensitive nav items.** Today's hearings on Calendar, tasks-due-today on Tasks, in addition to Inbox. Reuse `SidebarMenuBadge`; mute when zero. _Why:_ glance-able workload before clicking. _Impact: med · Effort: S._ _From Linear._

6. **Enrich the sidebar footer with status.** Above the identity dropdown, add a compact block for waitlist/trial or "case-monitoring: N matters synced" state (Vercel "Action Required" / Asana trial pill pattern). _Why:_ surfaces account + monitoring health where the eye already rests. _Impact: med · Effort: M._ _From Vercel/Asana/Cycle._

7. **Retune depth for dark.** Replace the light-tuned shadow ramp with subtle, low-spread dark shadows (or none) and **raise `--border` contrast ~1 step** so cards/sections separate cleanly. Reserve mint/lemon for accents/active/primary only — never as large fills. _Why:_ current depth is invisible; borders are doing all the work but too quietly. _Impact: med · Effort: S._ _From Vercel/Fey/Posh._

8. **Adopt low-saturation "dot + label" chips for tags/forum/source.** Match Linear's calm label pills (leading colored dot, muted text, hairline) instead of filled badges, so true urgency (overdue red) stays the loudest thing on screen. _Why:_ preserve the urgency hierarchy the DueDateBadge already nails. _Impact: med · Effort: S._ _From Linear._

9. **Single source of truth for routes.** Collapse the three route lists (`app-sidebar` NAV, `command-palette` NAV, `app-header` TITLES) into one shared `lib/nav.ts` with `{href,label,icon}`. _Why:_ prevents nav/palette/title drift as routes grow. _Impact: low (UX) / high (maintainability) · Effort: S._

10. **Add a first-run ghost-skeleton on key list pages.** For never-populated Matters/Tasks, show a ghosted preview of a row layout under the CTA (ClickUp pattern). _Why:_ previews the shape of populated data, lowers first-action friction. _Impact: low · Effort: M._ _From ClickUp._

---

## Quick wins
1. **Remove the duplicate page title** in `app-header.tsx` (render breadcrumb/context or nothing); let `PageHeader` own the H1. (Rec 4)
2. **Group the sidebar** into "Today" / "Case files" with quiet section labels — one `SidebarGroup` → two/three. (Rec 1)
3. **Add an icon slot to `EmptyState`** and rewrite the 4–5 most-seen empty copies to be benefit-led with a primary CTA. (Rec 2)
4. **Add a footer legend + Recent group to ⌘K** ("↑↓ navigate · ↵ open"); cheap, high perceived polish. (Rec 3)
5. **Bump `--border` one step and drop the heavy shadow ramp** so cards separate crisply on dark. (Rec 7)
