# Interview prep — Legal Owl

A working doc to prepare for talking about this project: what it is, the decisions behind it, the
trade-offs, and the debugging stories worth telling. Seeded with the real history; edit freely —
add your own voice, trim what's not useful, and fill in the reflection prompts at the end.

## The 60-second pitch

Legal Owl is an AI-native legal-office product for solo lawyers and small law firms in India. The
core bet: **AI answers/drafts must be traceable to real case data**, not generic LLM output — a
lawyer can't act on a plausible-sounding but ungrounded answer. The product tracks cases by CNR
against the eCourts India portals, keeps one unified case timeline, and layers approve-before-act
AI agents on top that ground every claim in a citation ledger.

Four tracks (see `STRATEGY.md`): **Court monitoring** (eCourts sync replacing manual portal checks),
**Case management** (the Client → Matter → Task system of record everything else depends on),
**AI document assistant** (chat grounded in a specific case file), **Client experience** (automated
updates + a client dashboard).

## Why this problem

- A solo litigator runs dozens of matters across portals, spreadsheets, and email — acting as a
  data-entry clerk instead of a lawyer.
- Generic LLM tools produce plausible text no careful lawyer will act on — wrong on a limitation
  date or an invented party name is a liability, not a help.
- The adoption wall in front of every case-management tool is manual entry: nobody hand-types 80
  running matters, so the record never gets populated and automation has nowhere to land. The
  wedge is making onboarding a matter the moment the product proves itself (dump a file → minutes
  later it answers questions with pin-cites).

## Architecture, in one paragraph

Next.js 16 App Router + React 19 on Vercel (Mumbai), Supabase Postgres in Mumbai for data/auth/
storage (RLS keyed on `auth.uid() = lawyer_id` everywhere — data residency under the DPDP Act).
Reads are Server Components; writes are Server Actions. The domain model is task-first
(Client → Matter → Task, Linear-inspired) instead of a sprawl of case-management tables. An
agent-grounding layer sits on top: a span-cited `facts` store + citation ledger, schema-locked
approve-before-act agents, and a define-once typed-action primitive so every mutation is reachable
from UI, HTTP, and an agent tool identically.

## Key decisions — and why (the material an interviewer will probe)

### 1. Task-first domain model: Client → Matter → Task
Replaced separate actions/hearings/deadlines/triage tables with one unified `tasks` table
(`type: task | hearing | deadline`, shared columns + a JSONB `attributes` bag for type-specific
legal fields). **Why:** hearings and deadlines are just tasks with a date — modeling them
separately would have meant three near-identical CRUD surfaces and three places for bugs to
diverge. The Inbox itself is just tasks parked in a system `Triage` state, not a separate table.
**Trade-off accepted:** `state_id` is nullable (hearings/deadlines carry none), so every read that
feeds a status badge has to filter `type='task'` — a small tax paid everywhere for a much simpler
core model. **How I'd defend it:** show the alternative (four tables, four sets of RLS policies,
four places to add a filter/sort) against the one table + a discriminator.

### 2. Append-only activity timeline, not court_events + remarks
One immutable timeline (`activity`) — synced `court_event` rows keyed by
`unique(matter_id, content_hash)` for idempotency, plus lawyer `remark` notes, with an immutability
trigger scoped to `kind='remark'` (so a lawyer can't quietly edit history, but the sync path can
still upsert idempotently). **Why:** a case timeline is the one artifact a lawyer and a court and
an AI agent all need to agree on — it has to be a single source of truth, not reconstructed from
joins across tables that can drift.

### 3. The citation ledger — the single most differentiating investment
Every agent-surfaced claim links to source refs; an unlinkable sentence is **dropped in the
renderer, not merely discouraged in the prompt**. Citations are tiered: structured facts (dates,
statuses, parties) cite record-level; documents/orders cite span-level (document + start/end
character offset). **Why this design, not RAG-with-a-disclaimer:** a disclaimer doesn't stop a
lawyer from acting on a wrong date. Gating at render time means the failure mode is "abstains,"
never "hallucinates confidently."

### 4. Deterministic span offsets — never trust the model's offsets
The LLM returns a **verbatim quote**; code computes the actual character offsets by searching the
source text (`lib/facts/resolve-span.ts`: exact match first, whitespace-tolerant regex fallback,
else null — never guess). **This came from a real bug** (see War stories below) and from reading
LlamaIndex's span-citation best practices before building it out further — validated the
verbatim-quote-then-locate pattern rather than trusting a model's self-reported offsets.

### 5. Deterministic dates for legal-consequential math
Limitation/appeal deadlines are computed by a rule engine over verified facts, with a
human-readable computation trace (rule, cited inputs, rule-pack version) — the LLM maps facts to
rule inputs and explains, but **never generates the date itself**. **Why:** a hallucinated
limitation date isn't a UX bug, it's malpractice exposure. This is the one place "the model is
usually right" isn't good enough.

### 6. Approve-before-act agents, not autonomous ones
Every agent mutation is a **Proposal Envelope** — a serialized typed action parked as a Triage task
with its citations and trace — and the lawyer approves, edits, dismisses, or snoozes. Nothing
writes or sends without a human signing it. **Why:** trust in a legal product is earned
incrementally; the Inbox the product already had for court-triage became the universal approval
surface for free, rather than building a separate "review AI suggestions" UI.

### 7. The typed-action primitive — define once, use everywhere
`defineAction({name, input, run})` gives one definition that serves as the UI action, the HTTP
endpoint, and the agent tool. An agent's "proposal" is literally a serialized call to one of these.
**Why:** without this, every new agent capability would need its own bespoke wiring from "the model
decided X" to "X actually happened in the database" — and that wiring is exactly where trust bugs
hide.

### 8. Host-agnostic model layer (OpenRouter today, adapters for later)
Agents are defined in YAML against a pluggable `AgentAdapter` interface; the shipped adapter calls
OpenRouter (free-tier auto-router during the demo phase), so swapping in Lyzr/CrewAI later is "write
an adapter, drop in a token" rather than a rewrite. **Why:** avoid coupling the product's agent
logic to one vendor's SDK before the product itself has proven which agents matter.

### 9. eCourts as sensor, agents as workers (not a status feed)
eCourts sync produces diffs (status/hearing-date/order changes); an ambient event
(`ecourts.synced`) lets agents interpret a sync into a *meaningful*, cited proposal instead of a raw
notification. **Deliberate scope boundary:** this ambient reaction only fires on **interactive**
syncs (the lawyer clicked "Sync now" or connected a matter by CNR) — the **nightly cron stays
deterministic**, with no LLM fan-out, so cost and failure blast-radius don't scale with the
matter count.

### 10. CNR as the hard isolation boundary
One matter's content must never surface for another matter — enforced at ingest (quarantine a
document whose case number doesn't match) and at query (matter-scoped retrieval). **Why it's
called out explicitly:** for a legal product, cross-case data leakage is *the* worst failure mode —
worse than a wrong answer, because it can be a confidentiality breach.

### 11. Design system discipline
shadcn on the **Base UI** registry (not Radix) — a `render` prop instead of `asChild`, explicit
`type="submit"` on every form button. Structural primitives (`PageShell`, `Panel`, `Callout`,
`StatusBadge`, etc.) are mandatory — no hand-rolled `mx-auto max-w-3xl` or ad hoc badge markup.
**Why:** in a fast-moving AI-assisted codebase, the fastest way to drift into inconsistent UI is
letting every page reinvent its own spacing/badge logic; primitives are the enforcement mechanism.

### 12. Minimal, not maximal, execution discipline
Repeated pattern in this project: build the smallest version that teaches the thing, verify it in
a real browser, then stop. The spotlight product tour is the clearest example — explicit user
instruction was *"you should not overdo it, keep it minimal functional"* and the shipped version is
3–4 steps with one card component, not a full onboarding framework. **Why worth mentioning in an
interview:** it's evidence of scope discipline under an ambiguous, exciting problem space (agents!
citations! tours!) — the temptation to over-build is real and the discipline was deliberate.

## War stories (good debugging narratives)

- **The silent enum bug.** `task_source` (a Postgres enum) didn't include `'agent'` yet every
  `emitProposal` insert for an AI-authored task was failing with
  `invalid input value for enum task_source: "agent"` — silently, because the write path swallowed
  the error. It was **only found by actually driving the product in Chrome** end-to-end, not by
  reading the code. Fixed with an `ALTER TYPE ... ADD VALUE IF NOT EXISTS`. **The lesson to tell:**
  a fully green typecheck/build says nothing about whether writes to a DB enum actually succeed at
  runtime — this is why the workflow insisted on browser verification, not just `npm run build`,
  before calling agent features "done."

- **LLM-reported span offsets were wrong.** The model said a citation was at `[144,153]`; the actual
  text was at `[145,155]`. **Root cause:** asking a language model to count characters is asking it
  to do arithmetic it's bad at. **Fix:** stopped trusting model offsets entirely — the model returns
  the quote text, code locates it. Cross-checked the approach against LlamaIndex's published
  citation-grounding practices before finalizing.

- **The agent wiring existed but was never turned on.** During an audit of how deeply eCourts is
  integrated, found that the `ecourts.synced` ambient event, the schema, and the subscribing
  agents were **all fully built** — but `runAmbient()` was never actually called from the sync path.
  The sensor was wired to nothing. Fixing it was a single new call site
  (`lib/agents/react.ts` → `runAmbient`), but finding it required systematically tracing what should
  have been a load-bearing wire and confirming it was dead. **The lesson to tell:** "it's built" and
  "it's connected" are different claims, and a repo audit needs to check the second one, not just
  confirm the first.

- **Free-tier rate limits crashing a live demo.** OpenRouter's free auto-router returned 429s that
  bubbled up as an uncaught error page mid-demo. Fixed with exponential-backoff retry in the client
  plus a deterministic fallback proposal so the demo's happy path never depends on a live LLM call
  succeeding within the fixed the window of a page load.

- **A registration bug from the "use server" boundary.** A typed action's top-level `register()`
  call didn't reliably run when the module was only reachable via a `"use server"` file's import —
  so approving an AI proposal fell through to a generic accept instead of actually executing the
  typed action. Fixed by moving the action into a plain module (mirroring the one action that
  already worked), imported explicitly wherever the accept path needs `get(name)` to resolve. **The
  lesson to tell:** module-execution semantics around Next.js's server-action boundary are subtle
  enough that "it compiled" isn't proof a registration side-effect actually ran — verify by testing
  the actual accept path, not just the type signature.

## Trade-offs I'd defend out loud

- **Relational facts + citation ledger now, knowledge graph later** — not because the graph idea is
  wrong, but because a Cypher-style knowledge graph is a *projection of verified facts*, and there
  were no verified facts yet. Shipping the graph first would have been building on sand.
- **Approve-before-act everywhere, even for "obviously safe" internal writes** — slower to demo,
  but the alternative (autonomy with an escape hatch) is exactly the kind of scope creep that erodes
  trust the first time it's wrong once.
- **A single shared eCourts API key / platform connection for v1**, not per-lawyer credentials —
  explicitly scoped out for now; the honest answer if asked "doesn't that mean no per-tenant
  billing/credit visibility yet" is "yes, and that's a known, written-down gap," not a surprise.
- **Nightly cron stays dumb on purpose.** Even though ambient agent reactions are a clear
  improvement, they're deliberately *not* applied to the batch/cron path, because unbounded LLM
  fan-out against every synced matter every night is a cost and reliability risk the interactive
  path doesn't have (a human is present to notice one failure; the cron isn't).

## Things I chose not to build (and why, if asked)

- **Associate/team task coordination, invoicing, enterprise firm targeting** — explicit
  `STRATEGY.md` scope boundaries; the product is for solo/small-firm litigators, and each of these
  pulls toward a different, larger buyer.
- **Autonomous send/filing** — every phase keeps the human as the sole authority on outbound
  actions and filings; the read-only nature of the eCourts partner API also makes this a hard
  boundary, not just a policy one.
- **A vendor AI order-summary feature that's commercially available** — deliberately not consumed,
  because grounding/citing orders ourselves *is* the product's differentiator; consuming an opaque
  third-party summary would undercut the exact thing being sold.

## Numbers / scope worth having ready

- Fill in: how many matters/tasks the demo seeds, how many agents are live vs. designed, what the
  eCourts integration depth audit concluded (rough current-state score and the prioritized gap
  list — see `docs/research/2026-07-06-ecourts-integration-audit.md`), time-to-first-cited-answer
  in the demo flow.

## Reflection prompts (answer these in your own words before the interview)

- What's the single decision here you'd make differently if starting over, and why?
- What was the hardest bug to actually *find* (not fix) — walk through the diagnosis, not just the
  patch.
- If asked "why not just use an off-the-shelf case-management SaaS plus a chatbot bolted on," what's
  your answer in two sentences?
- What would you build next with one more month, and what's the one thing you'd explicitly *not*
  build even with more time?
- Where did you push back on your own first instinct (scope, architecture, or otherwise) and why?

## Source docs to skim before the interview

- `STRATEGY.md` — product direction, the four tracks, explicit non-goals.
- `docs/ARCHITECTURE.md` — the technical architecture source of truth.
- `docs/design/agent-architecture.md` — the agent fleet, grounding, and orchestration design.
- `docs/research/2026-07-06-ecourts-integration-audit.md` — integration depth audit + leverage plan.
- `CLAUDE.md` — the terse, current map of how the codebase actually fits together.
