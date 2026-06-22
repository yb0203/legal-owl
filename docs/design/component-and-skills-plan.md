# Improving the product experience — component & skills plan

_How to raise Legal Owl's UX, grounded in (a) the shadcn/Base UI registry, (b) the
skills/tools available in this workspace, and (c) the in-flight Mobbin benchmark
(`docs/design/benchmarks/`). Theme constraint: the off-dark mint/lemon palette is deliberate —
benchmark **execution**, never revert to light._

Stack: Next.js 16 App Router · React 19 · Base UI (shadcn `base-nova` style) · Tailwind v4 ·
`@shadcn` registry only (no custom registries configured).

---

## 1. Component gap analysis (shadcn `@shadcn`)

**Installed — original 23:** avatar, badge, button, card, command, dialog, dropdown-menu, input,
input-group, label, popover, scroll-area, select, separator, sheet, sidebar, skeleton, sonner,
switch, table, tabs, textarea, tooltip.

**✅ Foundation laid (added — now 45 of 56):** empty, field, item, combobox, kbd, alert,
alert-dialog, breadcrumb, pagination, hover-card, resizable, collapsible, spinner, progress,
checkbox, radio-group, context-menu, drawer, toggle, toggle-group, button-group, calendar.
New deps: `react-day-picker` (calendar), `react-resizable-panels` (resizable), `vaul` (drawer).
Typecheck passes; `globals.css` untouched.

**Deliberately not installed:** `form` (pulls react-hook-form — conflicts with the Server-Action
form pattern; use `field` for layout + native form actions) · `chart` (recharts; analytics track
is deferred — `--chart-1..5` tokens already exist for when it lands).

**Highest-leverage additions**, by why they matter for a busy solo lawyer:

| Component | Surface it lifts | Why |
|-----------|------------------|-----|
| `empty` | every list (Matters, Clients, Inbox, Tasks, Calendar) | First-run and zero-state screens are currently undesigned; `Empty` gives a real icon + headline + CTA pattern. Biggest single perceived-quality win. |
| `field` + `form` | new matter, client intake, conflict check, settings | Replaces raw `<input>`+`<label>` with labelled, described, validated fields and consistent error treatment. |
| `item` | Matters/Clients/Tasks/Inbox rows | One standardized row primitive (media · title · meta · actions) → consistent density and alignment across every list. |
| `combobox` | assign-to-matter, pick client, conflict search | Searchable/typeahead pickers instead of long native selects — critical once a lawyer has 100+ matters. |
| `kbd` | command palette, inbox triage | Render shortcut hints (`⌘K`, `E` archive, `J/K` nav) so keyboard flows are discoverable. |
| `resizable` | Inbox / triage | Enables a split-view (list + detail) Superhuman/Linear-style triage layout. |
| `alert` + `alert-dialog` | destructive actions (delete matter/client/remark), inline errors | `AlertDialog` for confirmations (per shadcn guidance, not `Dialog`); `Alert` for form/page errors. |
| `pagination` | Matters, Clients | Scales long lists without infinite-scroll ambiguity. |
| `breadcrumb` | Matter detail, Client detail | Restores "where am I" context: Clients › Acme › Matter #1234. |
| `hover-card` | Matters/Tasks/Inbox | Peek a matter/client (status, next hearing) without leaving the list. |
| `spinner` + `progress` | actions, case workflow | We have `skeleton` for loads; add `spinner` for in-action and `progress` for case-stage completion. |
| `collapsible` | Home agenda, Settings, timeline | Group "Overdue / Today / Upcoming" and collapse long timelines. |
| `toggle-group` / `button-group` | Calendar, Matters | View switch (Day/Week/Month, List/Board) and segmented filters. |
| `checkbox` / `radio-group` | intake, conflict acknowledgement | Proper form controls (e.g. "I have run a conflict check"). |
| `context-menu` | list rows | Right-click row actions to complement the visible action menu. |
| `calendar` | hearing/deadline date entry | Date picker (react-day-picker) for the new-matter / event forms. |
| `drawer` | mobile | Bottom-sheet for actions on small screens (pairs with existing `sheet`). |
| `chart` | Court-monitoring analytics (deferred) | `--chart-1..5` tokens already exist in the theme; wire when analytics land. |

### Add commands

Tiers 1–3 below are **done** (installed in one pass). Remaining/optional:

```bash
# When analytics (court-monitoring) lands — adds recharts:
npx shadcn@latest add chart
```

### Useful registry blocks to read for composition (don't necessarily install wholesale)
- `dashboard-01` — sidebar + cards + **data table** reference for the Home/Matters layout.
- `sidebar-07` (collapses to icons) / `sidebar-08` (inset + secondary nav) — compare against our `app-sidebar.tsx`.
- The shadcn **data-table** pattern (`table` + TanStack Table) — for sortable/filterable Matters & Clients.

---

## 2. Skills & tools to drive the improvement (the "find-skills" answer)

There is no `/find-skills` skill in this workspace; below are the actually-available
skills/agents/MCPs that move product experience, in the order I'd reach for them.

**Inspiration & benchmarking (external grounding)**
- **Mobbin MCP** (`search_screens` / `search_flows` / `search_sections`) — already running the
  surface-by-surface benchmark → `docs/design/benchmarks/`.
- **shadcn MCP** (`search_items` / `list_items` / `get_item_examples`) — registry lookup + demo code.

**Design build & quality**
- **`vercel:shadcn`** (skill) — component & composition guidance for this exact stack. ✅ used here.
- **`compound-engineering:ce-frontend-design`** (skill) — build genuine design quality (composition,
  type, color, motion, copy), detects & respects our design system, **verifies via screenshots**.
  This is the primary "make it look intentional" skill.
- **`vercel:react-best-practices`** (skill) — TSX quality pass after editing components.

**Design review / iteration (agents)**
- **`ce-design-iterator`** — N screenshot → analyze → improve cycles on a surface.
- **`ce-design-implementation-reviewer`** — compares live UI against a target/spec.
- **`ce-design-lens-reviewer`** — flags missing design decisions in a plan before building.

**See it / verify it**
- **`run`** (skill) — launch the app and screenshot a change.
- **`verify`** / **`ce-test-browser`** — confirm a change actually works end-to-end in the browser.

**Decide what to build**
- **`ce-ideate`** / **`ce-brainstorm`** / **`ce-plan`** — turn the benchmark findings into a scoped plan.

---

## 3. Recommended sequence

1. **Land the Mobbin benchmark** (`docs/design/benchmarks/README.md`) → the prioritized Now/Next/Later.
2. **Install Tier-1 components** (`empty`, `field`/`form`, `item`, `combobox`, `kbd`, `alert*`).
3. **Fix zero-states first** (every list gets a real `Empty`) — highest perceived-quality/lowest effort.
4. **Standardize list rows** on `item`, and **forms** on `field`/`form` (intake, new matter, settings).
5. **Run `ce-frontend-design`** on one flagship surface (likely Matter detail or Home) to set the bar,
   then **`ce-design-iterator`** to refine via screenshots.
6. **`verify` / `run`** each change in the real app before committing.

> Correctness gate: no test suite — `npm run build` (tsc + routes) is the gate after changes.
