# Clients, intake & conflict check — UX benchmark

_Surface owner doc. Benchmark of Legal Owl's Clients list, client detail, new-client intake
form, and the conflict-check step, against best-in-class CRM / intake / KYC patterns from Mobbin._

---

## Current state (Legal Owl)

The surface is three routes plus two server actions:

- **List** — `app/(app)/clients/page.tsx`
- **Detail** — `app/(app)/clients/[id]/page.tsx` + `app/(app)/clients/[id]/actions.ts`
- **Intake** — `app/(app)/clients/new/page.tsx` + `app/(app)/clients/new/actions.ts`
- **Conflict engine** — `runConflictCheck()` in `lib/db.ts:59`

### Clients list (`clients/page.tsx`)
- Centered single column, `max-w-3xl`. Serif `PageHeader` "Clients" + "+ New client" (`:44–49`).
- A single server-side search box that filters by `display_name` via `ilike` (`:38`, `:51–54`).
- Rows are a bordered `<ul>` with divide lines: type icon (Building2/User), name, a secondary line
  that shows **email OR phone OR a type label** (`:80–82`), a matter count, a status pill, chevron
  (`:70–94`).
- Empty state is good and context-aware (search-aware copy, CTA only when no query) (`:56–67`).
- **Strengths:** clean, fast to scan, sensible empty state, the matter-count column is a genuinely
  useful "how active is this client" signal.
- **Weaknesses:**
  - **No sorting, no filtering, no segmentation.** You cannot view "Leads only", "Active only", or
    sort by most-recent-activity / most matters. `order` is hard-coded alphabetical (`:37`).
  - **Search is name-only.** A lawyer who remembers a phone number, email, or CNR cannot find the
    client. No debounced/live search — it is a full form submit (`:51`).
  - **The secondary line collapses information.** It shows email *or* phone *or* a type word — you
    never see both, and "Individual"/"Organisation" is low-value filler when contact info is missing.
  - **No "last activity / next hearing" signal** at the list level — the most decision-relevant
    column for a lawyer (which client has something happening soon) is absent.
  - **No bulk actions, no import, no count header** ("12 clients"). No avatars/initials, so the row
    leads with a generic grey icon.

### Client detail (`clients/[id]/page.tsx`)
- Back link, header with icon + serif name + a single muted line concatenating status · email ·
  phone (`:60–74`), and a "+ New matter" CTA.
- Conflict banner (urgent tone) rendered at top when open flags exist, each with an "Acknowledge"
  form button and optional "view matter" link (`:81–107`).
- Then stacked sections: **Matters** (list w/ forum + key + hearing pill), **Engagements** (only if
  any), **Contacts** (inline add form), **Notes** (only if present) (`:109–177`).
- **Strengths:** the matters list is the right hero; conflict banner is prominent; inline
  add-contact is a nice low-friction touch; everything is one scroll.
- **Weaknesses:**
  - **No structured "client info" panel.** Address, GSTIN, PAN, type, created date are captured at
    intake but **never displayed** on detail — only status/email/phone in the header line. A lawyer
    cannot see the PAN/GSTIN they entered without re-editing.
  - **No edit.** There is no way to edit a client after creation — no edit action exists in
    `actions.ts` (only `addContact` and `dismissConflict`). Status is fixed at creation.
  - **No activity / timeline.** Nothing shows recent events across the client's matters, last
    contact, or what changed. This is the single biggest gap vs. every CRM benchmark.
  - **No engagement → matter grouping.** Matters are listed flat; engagements are a separate,
    disconnected list with a raw status chip. The Client → Engagement → Matter hierarchy that the
    domain model promises is not visually expressed.
  - **Contacts are thin** — name, role, email/phone only; no primary-contact concept, no per-contact
    actions (email/call), email field is missing from the inline add form (only name/role/phone,
    `:165–167`).
  - **No quick actions** (email client, log a note, start a matter from here beyond the one CTA).

### New-client intake (`clients/new/page.tsx`)
- Single `max-w-xl` page, one long flat form: Name, Type/Status (selects), Email/Phone, Address,
  GSTIN/PAN, Notes, submit (`:29–90`).
- Conflict check runs **after submit**, server-side, inserting `conflict_flags` rows; the user is
  redirected to the detail page where the banner appears (`new/actions.ts:44–55`).
- **Strengths:** short, uses native selects (fast), promises a conflict check up front in the
  subtitle (`:25–27`), error display present.
- **Weaknesses:**
  - **Conflict check is invisible at intake time.** The promised "quick conflict check" never
    surfaces *during* the form — you only discover a conflict after the client is already created and
    you land on detail. There is no "we found a possible conflict, proceed?" moment, which is exactly
    the moment that matters legally/ethically.
  - **No field grouping / section headings.** Everything is one undifferentiated stack. Org-only
    fields (GSTIN) are shown for individuals; the form does not adapt to Type.
  - **No inline validation / formatting.** PAN and GSTIN are free-text with no format mask or check;
    email/phone are not validated beyond `type=email`. No duplicate-client detection ("a client
    named Rakesh Sharma already exists").
  - **No avatar/initial, no "add another contact at intake"**, no save-as-draft, no helper text on
    why GSTIN/PAN matter.

### Conflict check (`lib/db.ts:59` + detail banner)
- Normalizes the new client name and substring-matches it against `petitioners`/`respondents` of
  every matter (`:72–82`). Inserts a flag per match. Banner lets you "Acknowledge" (sets status
  `dismissed`).
- **Strengths:** the *idea* is exactly right and on-brand — conflict checking is a real, high-value
  legal workflow most generic CRMs lack.
- **Weaknesses:** only matches against **matter party names**, not against existing client names or
  contacts; no fuzzy matching (typos/initials/honorifics defeat substring match); runs only at
  client creation, never re-runs when a new matter/party is added later; "Acknowledge" has no record
  of *who/why/when* (no audit note), and there's no positive "No conflicts found ✓" confirmation,
  which is the artifact a lawyer actually wants to file.

---

## Inspiration gallery

### Pattern A — CRM contact/company **list** (table density, filters, segments)

**Attio** — [contact record / activity](https://mobbin.com/screens/cbd08067-203e-4051-b01b-a973a16a6d04)
- Left rail of record types (Companies / People / Lists), so the list view is one node in a clear
  object hierarchy — directly analogous to Client → Engagement → Matter.
- Record header shows linked entities as chips ("John Smith · Jane Doe · 5 days ago"), giving
  relationship context at a glance.

**Apollo — People** — [filterable people table](https://mobbin.com/screens/0b83400b-1a5f-4b7a-9029-f538ca0b1447)
- A **persistent left filter rail** (Persona, Email status, Job titles, Location, Industry) with
  saved filter chips at the top ("Persona ×"). This is the model for "Leads / Active / Inactive" and
  "has upcoming hearing" segments.
- Tabbed counts ("Total 5.4K · Not New · Saved") sit above the table — a lightweight saved-view
  pattern. "Save as new search" makes any filter set reusable.
- Columns are configurable (the "+" add-column affordance), and rows carry a checkbox for bulk ops.

**HubSpot — Contacts** — [contacts list with saved views + advanced filters](https://mobbin.com/screens/5179d751-e71a-4ebe-820e-a98ebc076e29)
- **Saved views as tabs** across the top ("All contacts", "Newsletter subscribers", "USA
  customers", "+ Add view 5/5"). Per-column sort arrows and a "Lead status" column shown inline.
- "Advanced filters", "Export", "Edit columns", and per-row inline edit — the full power-user kit
  without clutter. Avatars with colored initials make rows scannable.

**Juicebox** — [contact table with tags + role + org columns](https://mobbin.com/screens/47e60c5a-3bb3-4c97-b512-8ca0bb6ed483)
- Dense table with **inline editable Tags column** ("Re-engage later", "AI curious", "High prior…")
  rendered as colored pills, plus profile-link icons (LinkedIn/email/GitHub) per row. Shows how a
  status/segment can live *in* the row, not just as a single pill.

**Pipedrive — People** — [contacts table with owner/filter dropdowns](https://mobbin.com/screens/eff0b557-b0d6-44cc-ab7e-be2229b943c8)
- A favorites/owners/filters popover anchored to the toolbar, plus a green "+ Person" primary
  action with a split dropdown for import. Good model for a compact filter control on a `max-w`
  layout.

**Lightfield** — [minimal contact table with "Last interaction" column](https://mobbin.com/screens/7c47efa8-4343-42e8-a7f0-d51e14eab484)
- The **"Last interaction" column with relative time** ("4h ago", "1d ago") and a sort arrow on it.
  This is the exact column Legal Owl's list is missing — recency is the lawyer's triage signal.
- Account column links each contact to its parent company (the Engagement/firm analogue), and the
  table stays calm with one accent color.

### Pattern B — Contact / company **detail** with related records + activity

**Salesforce — Contact** — [contact detail with About / activity timeline / related cards](https://mobbin.com/screens/f233d9b9-bfcc-41f0-a498-a367cf5160b7)
- **Three-column layout:** left "About / Get in Touch" structured field panel (every field inline-
  editable via pencil), center **activity timeline** (upcoming & overdue, calls, emails, tasks
  grouped by month with filters), right column of **related-record cards** (Opportunities, Cases,
  Files) each with a count and "View All". This is the canonical "everything about this client on
  one screen" layout and maps cleanly to: left = client info (PAN/GSTIN/address), center = activity
  across matters, right = Matters / Documents / Deadlines cards.
- The [Recently-Viewed variant](https://mobbin.com/screens/0fbd15c5-b89c-4100-8a08-0e21138a85ed)
  adds a left list rail so you can flip between contacts without leaving detail.

**HubSpot — Contact** — [contact detail with activity feed + right rail](https://mobbin.com/screens/316878a5-0975-457c-84e7-3c0ef392657a)
- Left panel "About this contact" lists structured properties (email, phone, owner, **lifecycle
  stage**, **lead status**) each inline-editable, with "View all properties". Center is a rich,
  filterable **Activity / Notes / Emails / Calls / Tasks** tabbed feed. Right rail holds attachments
  and list memberships. The lifecycle-stage + lead-status pattern is a better model for Legal Owl's
  single `status` field.

**Zoho CRM — Contact** — [overview vs timeline tabs + related list rail](https://mobbin.com/screens/acf828c4-d7b8-40cf-98dd-72dae0e4d316)
- **"Related List" left rail** enumerating everything attached (Notes, Attachments, Deals, Open
  Activities, Cases, Quotes, Invoices…) with counts — clicking jumps to that section. Body has an
  **Overview / Timeline** toggle; Overview shows a compact "Deals" + "Next Action" summary and a
  collapsible full contact-information grid.
- The [Timeline tab](https://mobbin.com/screens/e1a5b857-6011-49b4-87a8-5e8f0ae53cf2) shows a dated
  history ("Task updated… Due date from X to Y by Sam Lee", "Contact Image uploaded") — an
  **append-only audit trail**, which is precisely what Legal Owl's `court_events` + `remarks`
  already produce but doesn't surface on the client.

**Attio** — [contact activity timeline + record details rail](https://mobbin.com/screens/cbd08067-203e-4051-b01b-a973a16a6d04)
- Beautifully restrained: activity grouped by "This week / This month / This year / 2022", a compact
  "Record details" rail with inline "Set Description / Set Phone" empty affordances, and a "Lists"
  membership card. Shows how a dark-friendly, low-chrome detail page can still be information-dense.

**Apollo — note composer** — [associate a note to records](https://mobbin.com/screens/0fbd15c5-b89c-4100-8a08-0e21138a85ed) (Notes/Tasks cards) and the [note-association panel](https://mobbin.com/screens/80175574-55aa-42bf-9ad0-dd88a1e78f0d)
- "Add note" / "Add task" cards directly on the contact, and a note composer that lets you
  **associate the note to records** (person/account/deal). Good model for "log a note on this
  client and optionally pin it to a matter."

### Pattern C — New-contact creation (quick add) & multi-step intake

**Front — Create contact** — [slide-over new-contact panel](https://mobbin.com/screens/65b20d06-f1ba-4fcb-a189-60c9051df1dc) (flow: [Creating a contact](https://mobbin.com/flows/707ab494-e532-423f-b5bf-6e13bade31c7))
- A **right slide-over** with "Contact Information * (at least one required)" — repeatable
  email/phone/handle rows with "+ add" affordances, an Account picker, and "Show more" to reveal
  advanced fields progressively. Create button stays disabled until valid. This is the ideal
  *quick-add* that doesn't force a full-page navigation.

**Apollo — Create New Contact** — [modal with Basic / Additional Information sections](https://mobbin.com/screens/42755a5a-399c-40cc-8629-e5385e9b41f8)
- Modal split into collapsible **"Basic Information"** and **"Additional Information"** accordions,
  with the company field as a type-ahead that creates the company if missing. Demonstrates field
  grouping inside a single modal so the form feels short but is complete.

**Pipedrive — Add person** — [add-person panel with labels picker](https://mobbin.com/flows/522ec9f2-8047-47a9-8c9b-2c32d13431da)
- "+ Add phone / + Add email" repeatable rows and an inline **Labels** picker (Customer / Hot lead /
  Warm lead / Cold lead) with colored chips and "+ Add label". A clean model for setting client
  status/segment at creation without a separate select.

**Mercury** — [6-step KYC-style onboarding with left step rail](https://mobbin.com/screens/8b12e7b5-4bd6-4eea-9a61-7ebbcfa4f855)
- **Left vertical stepper** (Company info → Company address → Ownership details → Company documents →
  Expected activity → Follow-up questions) with the active step highlighted and a "1/6" counter.
  Fields grouped per step, placeholder *examples* in inputs ("Example: Mercury is a fintech…"),
  optional fields explicitly marked "(optional)". The gold standard for a structured, multi-section
  intake that still feels light.

**Dovetail — Subscription** — [horizontal numbered stepper + summary sidebar](https://mobbin.com/screens/e3f4754a-2a9e-4db9-bff6-49a90ae58e3c)
- Top **numbered step indicator** (1 Plans · 2 Customer details · 3 Payment), required-field
  asterisks, a "Reference number (e.g. PO or vendor number)" helper, and a **persistent summary
  card** on the right ("Save and continue"). Good model for an intake that previews what's being
  created as you go.

**Oyster** — [Company Profile step with progress ring + grouped fields](https://mobbin.com/screens/bc93605c-119e-402a-8316-1062b34af05c)
- A circular "1/2" progress ring beside the section title and plain-language question labels ("What
  is your company's size?"). Conversational labeling that suits a lawyer entering a new client.

**Coinbase — Complete account setup** — [checklist of steps with time estimates](https://mobbin.com/screens/cb05158e-80fc-4d63-9dac-014693a0a524)
- A **task checklist** ("Create your account ✓ Complete", "About you ~2 min", "Verify identity
  ~5 min") with per-step time estimates and a single agreement checkbox + Submit. Excellent model
  for an intake "what's left" summary and for setting expectations.

### Pattern D — Verification / validation step (the conflict-check analogue)

**Airwallex — Verify ID** — [verification form](https://mobbin.com/screens/be279fa8-ba73-425a-8b85-07d5990267e7), [upload + uploading state](https://mobbin.com/screens/8e522698-cdfd-402e-89a7-74db905edc12), [per-individual verification status list](https://mobbin.com/screens/b01c7bec-6422-4265-be19-e2e7c7d70ed6) (flow: [Verifying ID](https://mobbin.com/flows/4ddfb2ef-818d-416c-b963-1dedf5c91aa9))
- The status list screen shows **each individual with an explicit status badge** — green
  "Electronically verified" vs. neutral "Submitted" — and an edit/eye icon per row. This is the
  exact mental model for a conflict check: a per-party **result with a clear pass/needs-review
  state**, not just a red banner.
- The verification *form* is its own dedicated step ("Verification" in the top bar) with helper text
  explaining *why* ("Submit ID details for each individual to verify their identity"), and a
  "Save for later" escape hatch. Conflict checking deserves the same first-class, explained step.

**PayPal — Upload documents** — [valid state](https://mobbin.com/screens/3a29b39d-51be-4820-879c-4c6a4895cc45) vs [error state](https://mobbin.com/screens/8ea4958b-7bb4-409a-8d8c-7983b3c2e15c)
- Strong **inline error treatment**: the dropzone turns red with "⚠ Uploaded file is incorrect" and
  the bad item shown with a delete affordance, while the valid state is calm. Models how a conflict
  result should *visually* differentiate "clear" from "flagged".

**Remote — onboarding checklist** — [in-progress 67% complete](https://mobbin.com/screens/42074683-8843-4220-8a92-d33c9c73ed4b) and [100% complete celebration](https://mobbin.com/flows/5774c9d9-6da9-46b3-a82d-864662920ca6)
- A friendly **completion artifact**: "Nice work, you're almost there! 67% complete" with each
  section as a green-checked card, and a celebratory "Great job, you've completed your onboarding 🎉"
  end state. A lawyer wants the equivalent "Conflict check complete — no conflicts found ✓" artifact
  to file/screenshot.

**Dialpad** — [persistent "Identity verification required" banner](https://mobbin.com/screens/ded1e4bc-b8c5-4aba-bf85-17a5f86433b0) and [in-progress dialog](https://mobbin.com/screens/801d8e74-676f-406c-8904-24b3f3f38987)
- A top-of-app **deadline-bearing banner** ("verify within the next 71 hours") and an "in progress"
  state dialog ("We'll let you know by email when it's complete"). Model for surfacing an *unresolved
  conflict* persistently until acknowledged.

---

## Gaps vs. best-in-class

1. **No detail-page client info panel** — Legal Owl captures address/GSTIN/PAN/type/created at
   intake but never shows them. Salesforce/HubSpot/Zoho all lead the detail with a structured,
   inline-editable "About" panel. (Detail page, `[id]/page.tsx:60–74`.)
2. **No activity/timeline on the client** — every CRM benchmark (Salesforce, HubSpot, Zoho, Attio)
   makes a dated activity feed the center of the detail page. Legal Owl already generates
   `court_events`/`remarks` per matter but never rolls them up to the client.
3. **No edit / no status change after creation** — only `addContact`/`dismissConflict` exist.
   Every benchmark supports inline edit (pencil per field).
4. **List has no filters/segments/saved views/sort** — Apollo, HubSpot, Pipedrive, Lightfield all
   ship filter rails, saved-view tabs, sortable columns, and a recency column. Legal Owl has only
   alphabetical order + name search.
5. **List search is name-only and not multi-field/relative-time aware** — Lightfield's "Last
   interaction" column and HubSpot's multi-field search beat the current single `ilike`.
6. **Intake is one flat form that doesn't adapt to type** — Mercury/Oyster/Apollo group fields into
   sections/steps and adapt to entity type; org-only GSTIN shouldn't show for individuals.
7. **Conflict check is invisible at the decision moment** — Airwallex/PayPal/Remote make
   verification a first-class, explained step with a clear pass/fail artifact. Legal Owl runs it
   silently post-create and only ever shows a red banner; there is no "no conflicts found ✓"
   confirmation and no audit of who acknowledged what and why.
8. **No quick-add slide-over** — Front/Pipedrive/Lightfield offer a fast slide-over/modal to add a
   contact without a full-page navigation; Legal Owl forces a route change to `/clients/new`.
9. **Hierarchy not visually expressed** — Zoho's related-list rail and Salesforce's related-record
   cards group everything under the record. Legal Owl lists matters and engagements as two flat,
   disconnected lists instead of Engagement → Matter grouping.
10. **No duplicate detection at intake** — none today; benchmarks (and basic CRM hygiene) warn
    "a client with this name/email already exists" before creating.

---

## Recommendations

> Prioritized. Impact (high/med/low) and effort (S/M/L) noted. All within the fixed dark mint/lemon
> theme — borrow structure and interaction, not color.

1. **Make conflict check a visible step with a pass/fail artifact.** _(Impact: high · Effort: M)_
   - On submit of `/clients/new`, instead of silently creating, run `runConflictCheck` and route to
     a **review step**: if matches, show a card per match with party name + matter link + a
     "Possible conflict" badge and a required choice ("Proceed and acknowledge" with a mandatory
     reason note, or "Cancel"); if none, show a green **"Conflict check complete — no conflicts
     found ✓"** confirmation before the client is finalized. Persist the result (and the
     acknowledger/reason) on the client so it's an auditable record.
   - Why: this is the legally/ethically load-bearing moment for a lawyer and the product's
     differentiator; a silent post-hoc banner buries it. Draws from **Airwallex** per-individual
     status list, **PayPal** valid/error states, **Remote** completion artifact.

2. **Add a structured, inline-editable "Client details" panel to the detail page.** _(Impact: high ·
   Effort: M)_
   - Left (or top) panel showing Type, Status, Email, Phone, Address, **GSTIN, PAN**, Created — each
     with an inline pencil edit (add an `updateClient` server action). Surface the data already
     captured but currently hidden.
   - Why: lawyers need to read back the PAN/GSTIN/address they filed without re-opening a form.
     Draws from **Salesforce / HubSpot / Zoho** "About" panels.

3. **Roll matter `court_events` + `remarks` into a client activity timeline.** _(Impact: high ·
   Effort: M–L)_
   - Center column on detail: dated, grouped ("This week / This month / Earlier") feed of events
     across all the client's matters (hearing updates, filings, documents added, notes), each
     deep-linking to its matter. Add a "Log a note" composer at the top.
   - Why: answers "what's happening with this client?" in one glance; reuses data the app already
     produces. Draws from **Zoho timeline**, **Salesforce activity**, **Attio**, **Apollo notes**.

4. **Group matters under engagements; turn the right side into related-record cards.** _(Impact: med
   · Effort: M)_
   - Render Engagement → Matter as nested groups (engagement name as a subsection header with its
     matters beneath), and add compact related cards with counts ("Matters 3", "Documents 8",
     "Deadlines 2 — 1 overdue") that link out.
   - Why: makes the Client → Engagement → Matter hierarchy legible and gives instant volume signals.
     Draws from **Zoho related-list rail**, **Salesforce related cards**.

5. **Add list filters, sort, and a recency column.** _(Impact: high · Effort: M)_
   - Segment chips/tabs (All / Leads / Active / Inactive) with counts, a sort control (Name / Most
     matters / Next hearing / Recently active), and a **"Next hearing" or "Last activity" column**
     in each row. Keep the `max-w` calm layout — a compact filter bar, not a full Apollo rail.
   - Why: a lawyer triages by "who has something happening soon", not alphabetically. Draws from
     **Apollo / HubSpot** saved views, **Lightfield** last-interaction column, **Pipedrive** filter
     popover.

6. **Upgrade list search to multi-field + show a count header.** _(Impact: med · Effort: S)_
   - Search across `display_name`, `email`, `phone` (and ideally matter `key`/CNR); add a small
     "N clients" count and initials avatars in rows.
   - Why: lawyers search by whatever they remember. Draws from **HubSpot** multi-field search.

7. **Restructure intake into grouped sections that adapt to Type.** _(Impact: med · Effort: M)_
   - Sections: "Who is this client?" (name, type, status), "Contact" (email/phone/address),
     "Tax & identifiers" (PAN always; **GSTIN only when Type = organisation**), "Notes". Add helper
     text ("PAN helps with billing & conflict matching"), required asterisks, and optional labels.
   - Why: a single flat list with irrelevant org fields is slower and error-prone. Draws from
     **Mercury / Oyster** grouped steps, **Apollo** Basic/Additional accordions.

8. **Add format masks + duplicate detection at intake.** _(Impact: med · Effort: M)_
   - Live PAN (`AAAAA9999A`) / GSTIN format hints + inline validation; on name/email blur, warn
     "A client named '…' already exists — view?" before allowing create.
   - Why: prevents dirty data and duplicate client files. Draws from **PayPal** inline error
     treatment; standard CRM hygiene.

9. **Quick-add client/contact slide-over.** _(Impact: med · Effort: M)_
   - A right slide-over launched from the list "+ New client" (and from matter creation) with the
     minimal fields + "Show more", so adding a client doesn't require a page change. Repeatable
     email/phone rows.
   - Why: speed for the common case. Draws from **Front** slide-over, **Pipedrive** add-person.

10. **Enrich contacts: primary flag, per-contact actions, email field in inline add.** _(Impact: low
    · Effort: S)_
    - Add an email input to the inline add form (`[id]/page.tsx:165–167`), a "primary contact"
      star, and `mailto:`/`tel:` actions per contact row.
    - Why: small polish that makes the contacts block actually usable. Draws from **HubSpot /
      Salesforce** "Get in touch" rows.

11. **Strengthen the conflict engine (back-end, supports #1).** _(Impact: high · Effort: M)_
    - Match against existing **client names and contacts** too (not just matter parties); add fuzzy
      matching (strip honorifics/initials, trigram similarity); re-run when a new matter/party is
      added; store acknowledgement metadata (who/when/reason).
    - Why: substring-only, parties-only, run-once checking misses real conflicts and lacks the audit
      trail a lawyer needs. Draws from **Airwallex** per-individual re-verification.

---

## Quick wins

1. **Show the captured client info on detail** — render Address / GSTIN / PAN / Type / Created in a
   small grid under the header. Data already exists; pure display. _(S)_
2. **Add an email field to the inline add-contact form** (`[id]/page.tsx:165–167`) and `mailto:`
   links on contact rows. _(S)_
3. **Add a "N clients" count + status filter chips** (All / Leads / Active / Inactive) above the
   list — cheap segmentation using the existing `status` field. _(S)_
4. **Broaden list search to email + phone** (extend the `ilike` to an `or(...)`) so lawyers can find
   clients by any handle they remember. _(S)_
5. **Add a positive "No conflicts found ✓" confirmation** after intake (even before the full review
   step in rec #1) so the conflict check produces a visible artifact rather than silence. _(S)_
