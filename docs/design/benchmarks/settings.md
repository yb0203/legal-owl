# Settings — UX benchmark

Benchmark of the Legal Owl **Settings** surface against best-in-class web SaaS settings,
sourced from Mobbin (platform: web). Dark theme is treated as a fixed constraint — we benchmark
execution, not the palette choice.

## Current state (Legal Owl)

The entire surface is a single Server Component: `apps/web/app/(app)/settings/page.tsx` (79 lines).
There is **no `actions.ts`** in the settings route — confirmed by directory listing — so nothing on
this page is actually editable. It is a read-only, centered, single-column card stack.

What exists today:

- A centered `max-w-2xl` page (`page.tsx:28`) with a serif `PageHeader` "Settings / Your account and
  preferences." (`page.tsx:29`).
- **Explore** card — wraps `DemoToggle` (`page.tsx:32-36`), the one genuinely interactive control. It
  seeds/clears demo data via a real `Switch` (`components/demo-toggle.tsx`) wired to Server Actions.
  This is the only functioning write on the page.
- **Profile** card — a `<dl>` of two static `Row`s: Email (from `auth.getUser()`) and a hardcoded
  "Data residency: Mumbai, India (ap-south-1)" (`page.tsx:38-43`). Nothing is editable; no name, no
  avatar, no firm details, no phone.
- **eCourts connection** card — descriptive copy + a `disabled` "Connect — soon" button
  (`page.tsx:45-54`). Placeholder.
- **Notifications** card — copy + a `disabled` "Soon" button (`page.tsx:56-65`). Placeholder.
- **Account** card — a single `Sign out` form posting to `logout` (`page.tsx:67-75`).

Supporting primitives that already exist and are underused here: `Switch`, `Input`, `Label`,
`Select`, `Avatar`, `Tabs`, `Separator`, `dialog`, `sheet`, `badge`, `table` (all in
`components/ui/`). The design system has everything needed to build a real settings surface; the
page simply hasn't been built out.

**Strengths**

- Visually consistent with the rest of the app (serif `PageHeader`, `SectionCard`, off-dark palette).
- The `DemoToggle` is a genuinely nice touch — a reversible "see it in action" switch is a strong
  onboarding pattern and is correctly wired.
- Honest about what's not built (explicit "soon" labels rather than fake controls).
- Clean information grouping into labelled cards.

**Concrete weaknesses**

1. **Read-only.** The user's own name, firm name, phone, and avatar cannot be set. For a product
   that sends client-update emails and renders client-facing dashboards, the lawyer's identity/firm
   block is foundational and entirely absent.
2. **No navigation / no scalability.** A flat vertical card stack on `max-w-2xl` works at 5 cards but
   collapses as settings grow. Best-in-class settings use a persistent left sub-nav (Linear, Stripe,
   Notion, Mercury, Melio). There is no IA to grow into.
3. **Two of five cards are dead placeholders** ("soon"/"Connect — soon"). They occupy prime real
   estate while doing nothing — no waitlist capture, no "notify me," no partial functionality.
4. **No notification preferences at all** despite client-update emails being a core product track.
   No control over email digests, hearing reminders, deadline alerts, or client-update cadence.
5. **No integrations surface** beyond the single disabled eCourts button. eCourts sync is the
   headline track; there is no per-court state, no last-synced timestamp, no status.
6. **No security/account controls** — no change password, no 2FA, no sessions/devices, no
   account deletion or data export (relevant for legal/PII data residency claims).
7. **No save affordance / feedback model.** Because nothing writes, there is no save button, no dirty
   state, no toast. When fields are added this will need a deliberate pattern.
8. **Data residency is a static string, not a trust surface.** A legal product should make data
   residency, encryption, and export feel like a deliberate, reassuring section, not a throwaway row.

## Inspiration gallery

### Pattern A — Persistent left sub-nav with grouped sections

**Melio** — [mobbin](https://mobbin.com/screens/ac45719a-952f-44c6-9bcc-ce8ce1580b36)
- Left rail groups items under bold category headers (**Company**: Profile, Company settings, Users
  and roles, Email notifications, Approval workflows…; **Payments & billing**; **Get Paid**). The
  active item gets an icon + highlight. This is the cleanest "settings that scale" model in the set.
- Right pane shows one section at a time with a section title + one-line description ("Manage your
  account profile and edit contact information") and an explicit **Cancel / Save** button pair pinned
  under the form — a clear, low-anxiety edit model.
- Disabled/system-owned fields (Email, Role) are visually muted to signal "not editable here," which
  is exactly how Legal Owl should treat the login email.

**Dovetail** — [mobbin](https://mobbin.com/screens/d6b3c793-eb67-47a5-ad2e-2e4a42cfdbde)
- Three-tier left nav (Your profile / Workspace settings / Workspace) with a faint per-item lock or
  badge for restricted items. Right pane mixes a profile form with an **Identities** sub-card and a
  **Support access** card ("Grant temporary access for troubleshooting, lasts 7 days, revoke
  anytime"). The support-access pattern is a great trust primitive for a legal product handling PII.
- Theme control lives inline as a simple `Select` (Browser default / Light / Dark) — a tidy way to
  expose appearance without a whole page.

**Lindy** — [mobbin](https://mobbin.com/screens/eed7e4e8-604e-4166-b30d-66aebd07ca70)
- A genuinely dark-themed settings page — useful direct reference for Legal Owl's constraint. Left
  nav split General/Workspace; right pane is a single bordered card containing Profile picture
  (Upload/Delete), inline **Edit** links per field, Change Password, and a **Two-Factor
  Authentication** block with two radio-style options (Authenticator app / Email verification).
- The inline "Edit" link per row (rather than every field always-editable) keeps a read-mostly page
  calm — good for a lawyer who visits settings rarely.
- A red **Delete Account** at the bottom shows the conventional destructive-action placement.

**Juicebox** — [mobbin](https://mobbin.com/screens/92ab8c8e-bd90-40a8-87eb-73bcfde6c7d4)
- Left nav grouped Account / Organization / Your Invitations. Right pane is a stack of discrete
  cards (Avatar, Display Name, Login Email, Active Subscription) where each card owns its own **Save
  Changes** button and a muted helper footer ("Contact support to change your login email").
- Per-card save (vs. one global save) is a robust pattern when sections are independent — worth
  considering for Legal Owl's Profile vs Firm vs Notifications split.

### Pattern B — Profile / account form done well

**Time2book** — [mobbin](https://mobbin.com/screens/2f847df5-c455-4b86-ab5e-7912278df2e2)
- Top tabbed sub-nav (Account / Children) + per-field **helper text under the label** explaining
  *why* the field matters: "Full name — This will appear on your public profile, invoices, and
  client-facing materials." This is the single most copy-able idea for Legal Owl: tie each field to a
  client-facing consequence so the lawyer understands the stakes.
- Profile photo as a circular upload target with a camera glyph — minimal, obvious.

**7shifts** — [mobbin](https://mobbin.com/screens/a4ee8811-ee9e-46a8-bbf7-f8172cac66a9)
- Two-column form layout: a wide details form on the left, a right column with **Profile photo** and
  a compact **Login & Security** card (Change password, Enable 2-step verification). Demonstrates how
  to fit identity + security on one page without a separate route.
- Phone fields use a country-code selector (relevant: Indian +91 numbers for client contact).

**Replit** — [mobbin](https://mobbin.com/screens/16e1b85d-0adc-49b1-8f9e-d99842518565)
- Inline success confirmation ("Server location updated" green bar) appears right under the changed
  field — a lightweight save-feedback model. Also shows two notification toggles living *inside* the
  profile page (transactional vs marketing email) for products with few preferences.

### Pattern C — Notification preferences with grouped toggles

**Mercury** — [mobbin](https://mobbin.com/screens/cd614ddf-6c42-41be-b0ed-1e1a1653e70e)
- A sub-list inside Notifications ("Balance alerts / Account activity 14 / My cards 3 /
  Reimbursements 4") with **counts**, and the right pane groups toggles under SPEND POLICY /
  SUBSCRIPTIONS headers, each toggle carrying a one-line description of exactly when it fires
  ("Sent at the end of the week to remind you…"). The per-toggle "what triggers this" copy is the
  gold standard.
- "All notifications will be sent to @mobbin.com" header makes the delivery target explicit — Legal
  Owl should show which email digests go to.

**Revolut Business** — [mobbin](https://mobbin.com/screens/56d18bce-6bbc-4916-89ed-772963905a14)
- **Dark-themed** (direct reference). Each category is a card with an icon, a **master toggle in the
  card header**, and child toggles for **Push / Email** channels — i.e. a channel matrix per event
  type. The "Low balance alerts" card even embeds an editable **threshold amount** inline. For Legal
  Owl, a "Deadline reminders" card could embed an editable lead-time ("remind me 3 days before").
- Master-toggle-disables-children is a clean way to handle "mute this whole category."

**Deel** — [mobbin](https://mobbin.com/screens/f31abe66-b620-4f8b-89ae-9d7395320dc7)
- Three-pane: category list (each row shows which channels are on: "Email, Push, SMS"), a per-category
  detail, and a global **"Choose where you get notified"** column with master Push/Slack/Email
  switches. Separating *channels* (global) from *events* (per category) is the most scalable model.

**SeatGeek** — [mobbin](https://mobbin.com/screens/975fe9b9-aaec-474f-a4cd-115f9fa1c570)
- Each preference shows a **frequency caption** under it ("A few per year", "One per week") so the
  user knows the volume before enabling. Great for Legal Owl's "Weekly matter digest" type toggles.

**GitBook** — [mobbin](https://mobbin.com/screens/27486654-94e9-44fb-b7a2-2c753ed00b74)
- Email/App **tabs** at the top of Notifications, then a table-like layout where each row event maps
  to column toggles. Tabs-by-channel is an alternative to Deel's columns when there are many events.

**Patreon** — [mobbin](https://mobbin.com/screens/2ffa2621-6351-45c4-a20f-a38d3671e93e)
- Minimal, calm version: two cards (Announcements / Notifications) of plain label + toggle. A good
  "v1" target before Legal Owl needs channel matrices.

### Pattern D — Integrations / connections

**Rox** — [mobbin](https://mobbin.com/screens/3e819b97-b78d-4adc-86ea-b100a8e6e9e7)
- Splits integrations into **CURRENT** (with a green "Connected" / amber "Connecting" status badge,
  plus gear + trash icons per connected item) and **NOT CONNECTED** (Connect buttons, some gated with
  an "Admin only" badge). This connected/available split with live status is exactly the model for
  the eCourts integration once it ships.

**Chatbase** — [mobbin](https://mobbin.com/screens/9d24c903-7050-4e16-b34e-71da42107d2c)
- Card grid where a connected item shows a muted **"Connected"** state and a "…" menu, others show
  **Connect**, and an inline success toast ("Slack integration successful") confirms the action.

**Sprout Social** — [mobbin](https://mobbin.com/screens/f75842a3-736b-4ebe-9628-f2c8d149e1c0)
- Card grid with logo, name, a one-line "what this does," and **Connect / Learn more**. Clean
  template for a future eCourts / Google Calendar / Gmail / WhatsApp integrations catalog.

**Mural** — [mobbin](https://mobbin.com/screens/b9091ea6-6cfd-42b6-9205-3f52484a09ea)
- Notable for the **"Can't find what you're looking for? Request an integration"** tile at the end of
  the grid — a cheap way to capture demand (and a far better use of space than Legal Owl's two dead
  "soon" buttons).

### Pattern E — Team / workspace members (forward-looking, for small firms)

**Copilot** — [mobbin](https://mobbin.com/screens/6cd14492-9ff4-4564-80ee-d848043aba7b)
- Members table (Name / Role / **Client access** / Status with Invited/Active badges) and an upsell
  card describing **Client Access** ("grant internal users selective access to specific clients").
  Directly relevant to small Indian law firms with junior associates.

**Maze** — [mobbin](https://mobbin.com/screens/f26c058f-8fed-45f7-96e1-8f205caa6a46)
- "Team members (2/5)" with seat count, an inline comma-separated invite field + role dropdown, and a
  per-row role selector. Clean, compact invite UX.

## Gaps vs. best-in-class

| Gap | Legal Owl today | Best-in-class reference |
|---|---|---|
| No editable identity | Email shown read-only; no name/firm/phone/avatar | Time2book, 7shifts, Lindy, Melio |
| No IA to scale | Flat 5-card stack | Melio / Dovetail / Mercury left sub-nav |
| Dead placeholder cards | Two "soon" buttons | Mural "Request an integration" demand-capture |
| No notification prefs | None | Mercury / Revolut / Deel grouped toggle matrices |
| No save/feedback model | Nothing writes | Melio Cancel/Save, Replit inline success, Chatbase toast |
| No security controls | Sign-out only | Lindy/7shifts 2FA + change password, Lindy delete account |
| No integration status | Disabled eCourts button | Rox connected/available split with status badges |
| Weak trust framing | Data residency = one row | Dovetail Support access, residency as a real section |
| No team/seats | None | Copilot/Maze members + roles |
| No "why this field matters" copy | Plain labels | Time2book per-field helper text |

## Recommendations

Prioritized. Each: what to build, why it matters for a busy solo lawyer, impact, effort, inspiration.

1. **Make Profile & Firm actually editable (create `settings/actions.ts`).** Add a Server Action
   `updateProfile` and fields for Full name, Firm/practice name, Phone (+91), and Avatar upload (to
   the existing `case-documents` or a new `avatars` bucket). Render as a `SectionCard` form with
   `Input`/`Label` and a per-card **Save** button (Base UI: set `type="submit"`).
   *Why:* the lawyer's name and firm appear on client-update emails and the client dashboard — these
   are the core product's outbound identity. Impact: **high**. Effort: **M**.
   Inspiration: Melio, 7shifts, Time2book.

2. **Add per-field helper copy tying each setting to a client-facing consequence.** e.g. under Firm
   name: "Appears on client update emails and the client portal." Under Phone: "Shown to clients for
   time-sensitive matters."
   *Why:* lawyers visit settings rarely; the stakes of each field must be self-evident. Impact:
   **high**. Effort: **S**. Inspiration: Time2book.

3. **Introduce a persistent left sub-nav and move to a sectioned layout.** Sections: Profile,
   Firm, Notifications, Integrations, Security, (later) Team, Billing. Use the existing `sidebar.tsx`
   primitive or a simple sticky `<nav>` column; keep the right pane at readable width. Each section is
   its own route (`settings/profile`, `settings/notifications`, …) or a tab.
   *Why:* gives the surface room to grow without becoming an endless scroll. Impact: **high**.
   Effort: **M**. Inspiration: Melio, Dovetail, Mercury.

4. **Build real Notification preferences with grouped toggles + trigger copy.** Categories: Hearing
   reminders, Deadline alerts, Client-update digest, New eCourts events, Weekly matter digest. Per
   toggle, one line of "when this fires" copy and a frequency caption. For Deadline/Hearing, embed an
   editable **lead-time** ("Remind me [3] days before"). Reuse the existing `Switch`. Back with a
   `notification_preferences` table (RLS on `lawyer_id`).
   *Why:* client-update emails and hearing/deadline reminders are core tracks; lawyers must control
   cadence to avoid noise. Impact: **high**. Effort: **M-L**. Inspiration: Mercury, Revolut (dark),
   Deel, SeatGeek.

5. **Replace dead "soon" buttons with a demand-capture / status pattern.** For eCourts and any
   not-yet-built integration, show a card with status badge ("Coming soon") and a **"Notify me"**
   action that records interest, rather than a disabled button. Add a "Request an integration" tile.
   *Why:* turns dead space into a signal of what to build next, and gives the lawyer a reason to
   engage. Impact: **medium**. Effort: **S**. Inspiration: Mural, Rox.

6. **Add a Security section.** Change password, 2FA (Supabase MFA), active sessions, and a
   conventional red **Delete account** + **Export my data** (PII/data-residency relevance). Frame
   data residency here as a real card ("Your data is stored in Mumbai, India (ap-south-1), encrypted
   at rest") rather than a throwaway row.
   *Why:* legal PII raises the bar on trust; export/delete are table-stakes and reinforce the
   Mumbai-residency selling point. Impact: **medium**. Effort: **M**. Inspiration: Lindy, Dovetail
   (support access), 7shifts.

7. **Design the eCourts integration card as connected/available with live status.** Once sync ships:
   show "Connected", last-synced timestamp, per-court list, and gear/disconnect controls; before
   then, the status-badge + Notify-me variant from #5.
   *Why:* eCourts monitoring is the headline differentiator; its settings should read as a
   first-class, observable connection. Impact: **medium** (high once sync ships). Effort: **M**.
   Inspiration: Rox, Chatbase, Sprout Social.

8. **Standardize a save/feedback model now.** Per-card Save with disabled-until-dirty, `useTransition`
   pending state, and a `sonner` success toast (already in `components/ui/sonner.tsx`). Show muted
   "not editable here" styling for the login email.
   *Why:* prevents an inconsistent edit experience as sections multiply; reassures the user the
   change stuck. Impact: **medium**. Effort: **S**. Inspiration: Melio (Cancel/Save), Replit (inline
   success), Chatbase (toast), Juicebox (per-card save).

9. **(Forward-looking) Team & seats for small firms.** Members table (Name/Role/Status), invite by
   email, and per-client access control. Defer until multi-user is on the roadmap (note: associate
   coordination is flagged out-of-scope in STRATEGY.md — scope this as *access*, not task assignment).
   Impact: **low** now. Effort: **L**. Inspiration: Copilot, Maze.

## Quick wins

1. **Make name/firm/phone editable** with a single `updateProfile` Server Action + per-card Save —
   the highest-value gap, achievable with existing `Input`/`Label`/`Switch` primitives (#1).
2. **Add per-field helper copy** ("Appears on client update emails…") — pure copy, no schema (#2).
3. **Swap the two disabled "soon" buttons for "Notify me" + a "Coming soon" badge** and a "Request an
   integration" line — removes dead space, captures intent (#5).
4. **Reframe Data residency as a small trust card** ("Stored in Mumbai (ap-south-1), encrypted at
   rest") instead of a bare row (#6).
5. **Wire a `sonner` success toast** to the existing `DemoToggle` and any new save, establishing the
   feedback pattern before more controls land (#8).
