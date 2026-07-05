---
name: Product UX — entity mental model & agentic journeys
last_updated: 2026-07-05
---

# Legal Owl — Product-UX Design Brief
## "One file, one clerk, one signature"

**Premise.** A solo Indian litigator already runs the system we built — they just run it on paper. The brief (file), the munshi (clerk who puts things up), the order sheet (append-only record), the advocate's diary (dates), the board (cause list). Our job is not to teach them a schema; it is to let them recognise their own office. Every naming and layout decision below is held to that test: *would the lawyer recognise this from their chamber?*

**One structural decision up front.** The 2026-06-23 layout decision (single column, `max-w-3xl`, no side rails) stands. The "always-present right-sidebar assistant" is therefore **not a persistent pane**: it is a summonable overlay drawer (⌘J / an "Ask Owl" affordance in the header) that slides over the right edge and dismisses back to a slim presence — a floating owl mark carrying a count of pending proposals *for the current scope*. Present, never resident. This resolves the foundation's "always-present" requirement without re-cluttering the reading column the user explicitly flattened.

---

## 1. The lawyer's mental model vs. the data model

### What a litigator actually thinks in

| The lawyer's head | Their words |
|---|---|
| The case file | "the Sharma matter", "my brief", "the file" |
| Dates | "next date" (NDOH), "what's listed tomorrow", "the board", "taarikh" |
| What happened last time | the order sheet, "matter was adjourned for evidence" |
| What's next | "purpose of hearing: arguments", "written statement is due" |
| Limitation | "how many days do I have from the certified copy?" |
| Clients | party names; the phone call: *"vakeel sahab, kya hua case ka?"* |
| Office drill | "the filing checklist", "put it up for my signature" |

### What the schema thinks in
`tasks.type` enums, `attributes` JSONB, `task_steps` (kind `act`/`check`), `facts` with `source_rank` and char-offset spans, a `citations` ledger of record-refs/span-refs, `playbook_items` scoped `state|firm|personal`, `Proposal` envelopes with `dedupe_key`s parked in Triage.

### The gaps, named
1. **"Task" is our abstraction, not theirs.** A hearing is an *appointment with the court*; a deadline is a *sword hanging*; a to-do is office work. The unification is engineering elegance — the UI must keep the three faces distinct (`HearingPill` vs `DueDateBadge` vs `StatusBadge` already do this; never let a row say "task · type: hearing").
2. **"Citation" is a trap.** To an Indian lawyer, a citation is *case law* — an AIR/SCC reference. If we label AI provenance "citations," we collide with the most loaded word in their vocabulary. **UI name: "Sources."** The ledger never appears as a noun; it appears as source pins on claims.
3. **"State" playbook scope is a triple collision** — Indian states, workflow_states, government. Never render it. **UI layer names: Statutory → Chamber → Personal**, with the `source_ref` ("Limitation Act, 1963 §12(2)") shown via the existing `RuleHint` primitive.
4. **"Triage" is medical.** The state exists in the DB; the UI says **Inbox**, and the badge on a parked item says **New** (the `StatusBadge` triage glyph stays; its label changes).
5. **Acts/Checks are invisible concepts** until you're inside one task. That's correct — keep it that way (see the disclosure ladder).
6. **"Proposal/agent/approve-before-act" maps perfectly to an existing office idiom:** the clerk *puts up* a file for signature. The agents are already named as office staff in the registry (`limitation-clerk`, `intake-registrar`) — lean into it. Cards are bylined *"Put up by Limitation Clerk"*; the approve button is the signature.

### The naming table (what the UI says)

| Schema | UI name | Notes |
|---|---|---|
| `tasks` type `task/hearing/deadline` | Task / Hearing / Deadline | never expose "type" |
| Triage state | Inbox (badge: "New") | never "Triage" |
| `task_steps` kind `act` | **Steps** | plain do-list inside a task |
| `task_steps` kind `check` | **Checks** — results render **Cleared / Flagged / N/A** | "cleared for filing" resonance; never "pass/fail" |
| `facts` | **Case facts**; `proposed`→ **Unverified**, `verified`→ **Verified** | this card already existed on matter detail — same home |
| `citations` | **Sources** (a "source pin" glyph) | reserve "citation" for future case-law features |
| `playbook_items` | **Playbook**, layers **Statutory / Chamber / Personal** | lives in Settings; surfaces contextually |
| `Proposal` envelope | **"For your approval"** card, bylined by clerk name | verb: Approve (and the existing snooze/dismiss) |
| `confidence` | never a number | low confidence = the item arrives pre-expanded for review |
| `activity` | **Case history**, grouped by date like an order sheet | court events + your notes, `SourceChip`'d |
| `attributes` JSONB | invisible — renders as ordinary fields in the properties rail | |

### Progressive-disclosure ladder (the lawyer never has to descend)
- **L0 — Lists** (Home, Tasks, Matters): only badges — `StatusBadge`, `DueDateBadge`, `HearingPill`, a tiny steps fraction ("3/5") and a checks glyph. Nothing new to learn.
- **L1 — The task, opened**: Steps and Checks appear, each with a provenance chip (manual / playbook / assistant per `StepSourceEnum`). This is where the deep model is *encountered*, one task at a time.
- **L2 — The source pin, tapped**: a popover with the quoted span, the document name, and a "view in document" jump. One interaction teaches the entire grounding contract.
- **L3 — The machinery, sought**: Verification Bench, Playbook editor, agent registry. Only for lawyers who go looking.

A lawyer can live at L0–L1 forever and still get the full value. The schema is the plumbing; the pins, chips, and fractions are the taps.

---

## 2. Information architecture

**Keep the nav shape.** Today (Home, Inbox, Tasks, Calendar) / Case files (Matters, Clients) / Help, Settings is already grouped the way a lawyer works — `lib/nav.ts` stays the single source of truth. Changes are internal to screens:

```
TODAY
├─ Home        "Your day" — the Board (today's hearings, in listing order,
│              with purpose-of-hearing), Overdue (loudest), Inbox digest,
│              one-line morning note from Owl (source-pinned)
├─ Inbox       ONE queue, two voices: Court updates (eCourts) and
│              For your approval (clerk proposals) — same row anatomy
│              (triage-row.tsx), same verbs: Accept/Approve · Snooze · Dismiss
├─ Tasks       unchanged; rows gain the steps fraction + checks glyph
└─ Calendar    unchanged; Today view is framed as "Your board" (cause-list
               language), never hides overdue
CASE FILES
├─ Matters     ── Matter file = THE SPINE ──────────────────────────────
│              single column, stacked (CollapsibleSection):
│              1. PageHeader: parties · ForumBadge · CNRChip · HearingPill
│                 (next date) — the docket sheet
│              2. Case facts (SectionCard): verified facts w/ source pins;
│                 "4 unverified — review" → the Verification Bench
│              3. Open tasks (hearings/deadlines first, task-list.tsx)
│              4. Documents
│              5. Case history (order-sheet-styled activity + your notes)
└─ Clients     person/org + their matters + "last told on <date>" (see J4)
FOOTER
├─ Help        glossary already linked from ModelOrientation
└─ Settings    + Playbook (Statutory/Chamber/Personal tabs) · Labels stays at /labels
```

**Where the new entities live — one home each, ambient echoes elsewhere:**

| Entity | Primary home | Echoes |
|---|---|---|
| Steps/Checks | inside Task detail only | fraction + glyph on `ListRow` meta |
| Case facts | Matter file card | source pins wherever a fact is used; properties auto-filled from verified facts show a `RuleHint` ("from the order dated 12-Mar") |
| Verification Bench | a matter-scoped review mode (`/matters/[id]/verify`) | Inbox digest row: "12 facts extracted from 3 documents — review" |
| Case history | Matter file | Home's "what changed" digest |
| Playbook | Settings | provenance chips on playbook-fanned steps link back ("From your Chamber playbook: DHC filing drill") |
| Proposals | Inbox | identical ProposalCard inside the assistant drawer and inline on the matter file |

**Is the matter file the spine? Yes — and say so visually.** Everything in Today is a *view over matter files*; every Today row carries its matter's name and deep-links into the file. The file is where the day's work lands; Today is where it's triaged. That sentence is also the onboarding line.

**The assistant drawer** (overlay, per the decision above) is scope-aware: opened on a matter route, its header carries a **scope chip** — `Scope: Sharma v. DDA · DLHC01-001234-2025` in Geist Mono — declaring that answers come only from this file. Its output obeys the same rules as everything else: source pins on every claim, ProposalCards for anything that would change data.

---

## 3. Key journeys, with the assistant woven in

### J1 — New client walks in (intake + conflict)
1. `/clients/new`: name, phone, opposing party. On blur of the opposing-party field, the **advisory conflict check** renders as a `Callout` (tone: caution, never blocking): *"Ramesh Gupta appears as opposing party in 2 of your matters"* — with links. Advisory means the lawyer decides; the flag persists on the client record (`conflict_flags`).
2. Lawyer drops the vakalatnama and the brief's first pages onto the client record. The **Intake Registrar** (ambient trigger: `document.uploaded`) extracts party names, forum, case number — each as an Unverified fact with a span.
3. Minutes later, the Inbox holds one card: **"Put up by Intake Registrar — Create matter: Gupta v. Sharma, District Court Saket"**, `trace` explaining *why*, every field source-pinned to the vakalatnama. Approve = the matter is born.
4. On birth, the Playbook's intake checklist fans in Steps ("File vakalatnama", "Prepare index") and Checks ("Court fee computed?", "Limitation cleared?") on a setup task — each chip'd "From Statutory playbook" or "From your Chamber drill."

*The lawyer typed a name and a phone number. Everything else was put up for signature.*

### J2 — Dump the file (ingestion + Verification Bench)
1. On the matter file, drag in the whole PDF bundle — plaint, orders, notices. Upload rows appear in Documents with quiet "reading…" states.
2. Facts land Unverified on the Case facts card: *"4 verified · 9 unverified — review"*. The count links to the **Bench** (`/matters/[id]/verify`): one fact per card — `value_text` large, the quoted span highlighted in context below, source document named, `source_rank` shown as a plain-language authority chip ("from a court order" vs "from your upload"). Keyboard-first: **V** verify, **E** edit, **X** reject — the same triage cadence as the Inbox. Low-confidence facts arrive pre-expanded; high-confidence ones are one keystroke.
3. The moment a *date-bearing* fact is verified, the **Limitation Clerk** runs (on-demand trigger, chained off verification) and a ProposalCard appears at the bottom of the bench and in the Inbox: *"Appeal limitation expires 04-Sep-2026 — 90 days from decree dated 06-Jun-2026 · Limitation Act, 1963, Art. 116"* — the trace is the reasoning, the pins are the decree's span. Approving creates the Deadline; the `DueDateBadge` ramp takes over from there.
4. Verified facts back-fill the matter's properties rail — each auto-filled field carries a `RuleHint` naming its source, so the file visibly assembles itself *from evidence, not from magic*.

### J3 — A court day (board → prep → outcome → fan-out)
1. **Morning, Home.** The Board: today's hearings in order, each with purpose-of-hearing ("arguments on interim application") and matter name. Overdue items sit above it in solid urgent — nothing outranks a missed date.
2. **Tap a hearing.** The hearing task shows its prep pack: Steps from the Playbook drill ("Carry originals", "Brief on the last order") and Checks ("Certified copy on file?" — Cleared/Flagged/N/A). A "Prep note" panel, drafted by the assistant *from this file only* (scope chip visible), summarises the last order and open points — every sentence pinned.
3. **After court: "Record outcome."** One quick form, not a wizard: What happened? *Adjourned* → next date (the single commonest outcome in Indian litigation gets the fewest keystrokes: date field, purpose, done). *Order passed* → upload order.
4. **The fan-out — all as proposals, never silent writes.** Adjourned: next Hearing task put up pre-filled + "Tell the client?" draft put up. Order uploaded: facts extract → Limitation Clerk → appeal-deadline proposal (J2's machinery, re-entered from the other side). Everything lands in the Inbox with the familiar card; the lawyer signs off the day's paperwork in five keystrokes on the train home.
5. The outcome, the order, and every approval write to **Case history** — the order sheet stays true without separate data entry.

### J4 — "Kya hua case ka?" (the client update)
1. Client calls. Lawyer opens the matter (⌘K, type "Sharma"), hits **Client update** in the header.
2. The assistant drafts from Case history *since the last update sent* — plain language, no legalese, next date included via the same `HearingPill`. Every sentence carries a source pin; the **unlinkable-claims rule is visible, not silent**: a muted stub reads *"1 line removed — no source in the file."* Trust is built by watching the system delete its own unsupported words.
3. Lawyer edits freely (their words always win), Approve → Resend sends it; the sent update is logged in Case history and the client record shows *"Last told: 05-Jul."* Home can then surface a gentle ambient proposal for matters with movement but a stale "last told" — client hand-holding becomes a queue, not a memory burden.

---

## 4. Making the model self-teaching

**Teach by provenance, not by tutorial.** The single strongest teaching device is already latent in the design: *every artifact names its parent.* A step says "From your Chamber playbook"; a fact says "from the order dated 12-Mar"; a deadline says "Put up by Limitation Clerk"; a court event says "eCourts." A lawyer who reads chips for a week has learned the entire model without a single doc page.

1. **Onboarding is one loop, not a tour.** After signup: create a client (30 seconds) → drop one document → approve one proposal → verify one fact. Four actions, and the lawyer has personally executed Client → Matter → Task → Fact → Approval. Each completion fires a single `sonner` toast that names what just happened in model language ("Fact verified — it now backs this matter's filing date").
2. **"See it in action" carries the deep model.** The existing demo toggle (`demo-toggle.tsx`, `sample-data-banner.tsx`) seeds one believable matter — *Sharma v. DDA*, Delhi HC, correctly-formatted CNR — staged mid-story: a hearing tomorrow, one overdue deadline (so the urgency ramp shows), two unverified facts on the Bench, and one Limitation Clerk proposal waiting in the Inbox. The demo isn't a screenshot; it's a rehearsal — every teaching moment from §3 is one click away, and dismissing the sample banner clears it.
3. **Empty states each teach one rung** (the `EmptyState` primitive, already everywhere): Tasks empty → "Tasks live on matter files — open one"; a task with no steps → "Break this into steps, or pull the filing drill from your Playbook" (one-tap apply); Case facts empty → "Drop the file's documents here — Owl reads them and puts facts up for your verification." Extend `ModelOrientation` (currently Client → Matter → Task) with one more sentence, not one more box: *"Inside a task: steps to do, checks to clear — Owl puts both up, you sign."* The three-box chain stays three boxes; the depth is prose.
4. **The Help glossary is the ceiling, not the floor.** Every chip and pin deep-links to `/help#glossary` (the `ModelOrientation` → glossary path already exists) — documentation as an escape hatch for the curious, never a prerequisite.

---

## 5. Six cohesion moves (non-obvious)

1. **One ProposalCard, three doors, one signature.** The identical component renders in the Inbox, the assistant drawer, and inline on the matter file — same byline, same pins, same Approve/Snooze/Dismiss (the Inbox's existing verbs; approval *is* triage-accept). The `dedupe_key` makes it honest: approve it in the drawer and the Inbox copy resolves instantly. The lawyer learns one interaction and owns the whole agent fleet.
2. **The scope chip makes grounding visible.** Assistant drawer, Verification Bench, and ⌘K palette all carry the same chip: matter name + CNR in Geist Mono (the existing `CNRChip`). It is a *promise rendered as UI*: answers come only from inside this chip. Tap to widen scope ("All matters") — and watch the pins change to say which file each claim came from. CNR isolation stops being an architecture note and becomes a thing you can see.
3. **The source pin is one component, everywhere, including absence.** Chat sentence, case fact, proposal trace, client-email preview — the same superscript pin opening the same popover (quote, document, jump-to-span; or record link for record-refs). And the *negative space is standardised too*: the "n lines removed — no source" stub renders wherever generation happens. The citation contract is felt, not documented.
4. **Extend `SourceChip` to a provenance triad: Court / You / Owl.** Today it distinguishes eCourts (Landmark) from You (PenLine); add the owl mark (`owl-mark.tsx` exists) as the third voice, and use the triad uniformly across Case history, Steps/Checks (`StepSourceEnum` maps 1:1: playbook and assistant → Owl-tinted, manual → You), facts, and tasks. One glance anywhere answers "who put this on my file" — which is the entire trust question for an agentic product.
5. **Checks are gates you can see through — and step over.** A shield-check glyph on `ListRow` meta shows gate state at L0; completing a task with unresolved checks gets a soft interstitial — *"2 checks not cleared: Court fee computed? Certified copy on file? — Complete anyway"* — never a hard block. The lawyer is sovereign; the system is the careful junior who says "sir, one minute" and then obeys. Overriding writes the flagged checks to Case history, so the file remembers the judgment call.
6. **Every approval becomes an entry on the order sheet.** Accepting any proposal appends an activity entry carrying the clerk's byline, the trace, and the pins — the append-only Case history doubles as the audit ledger of the human-agent relationship. Six months later, "why does this deadline exist?" is answered the way a lawyer expects: it's on the file, in the order sheet, with its authority cited.

---

**Risks to watch:** pin density in chat (cap visible pins per paragraph, collapse to a trailing "3 sources"); Bench fatigue on large bundles (batch-verify high-confidence facts by document); the Inbox becoming two products in one queue (keep the two voices visually distinct via the triad chips but behaviourally identical); and the temptation to make the assistant drawer resident on wide screens — hold the single-column line until the owner revisits it.
