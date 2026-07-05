---
name: Agent architecture
last_updated: 2026-07-05
---

# Agent architecture

How Legal Owl's agent platform is laid out under `apps/web/lib/`, how a claim gets from a
document to a lawyer's Inbox to an executed mutation, and how to extend it with a new agent
or action. Companion to the grounding-layer migration
(`supabase/migrations/20260705000001_agent_grounding_layer.sql`) and
`apps/web/lib/types.ts`.

## `lib/` layout

```
apps/web/lib/
  schemas/            grounding-layer Zod schemas — data shapes, no behaviour
    provenance.ts       shared building blocks: DocumentSpan, Confidence, SourceRank,
                         ExtractorVersion, StepSource — composed by, not redefined in,
                         the files below
    fact.ts             FactValueSchema (the jsonb payload shape) + FactSchema (a `facts` row)
    citation.ts         CitationRefSchema (RecordRef | SpanRef — the tiered citation model),
                         the `citations` ledger row schema, MessageClaimMap
    act.ts / check.ts   the two `task_steps` species (kind='act' | 'check')
    proposal.ts         ProposalSchema — the envelope agents mint (canonical; see below)
    playbook.ts         PlaybookSpec (rule | checklist | template) + `playbook_items` row
    index.ts            barrel — `import { X } from "@/lib/schemas"` re-exports all of the above

  actions/            the mutation primitive — one definition, three transports
    define-action.ts    defineAction, ActionContext, ActionResult, buildActionContext,
                         formDataToObject, register()/get()
    index.ts            barrel — `import { X } from "@/lib/actions"`
    <action-name>.ts    one file per registered action (e.g. task-create.ts), each calling
                         defineAction and register()

  agents/             the agent primitive + orchestration
    define-agent.ts     defineAgent, AgentContext, AgentResult, AnyAgent, AgentTrigger —
                         agents are READ-ONLY; the only mutation channel is a Proposal
    proposal.ts         re-exports ProposalSchema/Proposal from lib/schemas verbatim +
                         createProposal (the one way an agent mints a Proposal)
    registry.ts         the one agent registry: the `agents` const map + getAgent /
                         listAgents / listAgentsByTrigger
    orchestrator.ts     route() (sidebar picker), ask() (run one agent + gate), runAmbient()
                         (event fan-out), emitProposal() (Proposal → Inbox), and the render
                         gate (gateProposal / gateProposals / hasCitations)
    agents/<name>.ts    one file per specialist agent (e.g. limitation-clerk.ts,
                         intake-registrar.ts), each calling defineAgent
```

## Data flow: facts → agents → proposals → Inbox → actions

1. **Facts.** Extraction writes `facts` rows (`apps/web/lib/schemas/fact.ts`) — each one a
   single typed claim (`party_name`, `filing_date`, …) with its own span provenance
   (`document_id` + `start_offset`/`end_offset`) baked onto the row. A fact is self-citing:
   its span *is* its citation.
2. **The citation ledger.** Anything else that asserts a claim — an agent's output, a chat
   message, a `task_steps` check — points back to evidence via a `CitationRef`
   (`apps/web/lib/schemas/citation.ts`): either a `record` ref (a row in `facts` / `activity`
   / `tasks` / `documents` / `matters`) or a `span` ref (a raw char-offset range into a
   document). This is the one shape shared by the `citations` table, `messages.metadata`,
   and every `Proposal.citations` array.
3. **Agents read, never write.** A specialist agent (`apps/web/lib/agents/agents/<name>.ts`,
   built with `defineAgent` from `apps/web/lib/agents/define-agent.ts`) is handed an
   `AgentContext` whose `supabase` client is READ-ONLY by convention — it queries facts,
   activity, matters, documents — and returns an `AgentResult`: a schema-validated `output`
   plus zero or more `Proposal`s, each minted via `createProposal`
   (`apps/web/lib/agents/proposal.ts`) and citing ≥1 `CitationRef`.
4. **The orchestrator gates and parks.** `apps/web/lib/agents/orchestrator.ts` is the single
   choke point every Proposal must pass through before it can be seen or acted on:
   - `gateProposal` / `gateProposals` drop any proposal with zero citations — "no citation,
     no render, no action" is enforced in exactly one place.
   - `emitProposal` maps a surviving Proposal onto a `tasks` row in the system **Triage**
     workflow state (the Inbox already *is* tasks parked there) — `type='task'`, `key=null`,
     `source='agent'`, the envelope verbatim in `attributes.proposal`. It is idempotent on
     `attributes.proposal.dedupe_key`, so re-running the same extraction never double-parks.
   - `runAmbient` fans an event (`ecourts.synced` / `document.uploaded` / `task.completed`)
     out to every ambient agent subscribed to it and calls `emitProposal` for each surviving
     proposal; per-agent failures are isolated so one broken specialist never blocks the rest.
   - `route` / `ask` serve the sidebar case: pick which agents apply to the current page,
     then run one on demand — same gate, but the caller decides whether/when to file a
     result into the Inbox.
5. **A lawyer accepts.** The Inbox card is a normal Triage item
   (`apps/web/app/(app)/inbox/actions.ts`): accept, dismiss, or snooze exactly like any other
   triaged task. Accepting a proposal re-validates `attributes.proposal.args` and calls the
   named action (`proposal.action`, e.g. `"task.create"`) through its `execute()` — the only
   place in the whole path a mutation actually happens.
6. **Typed actions execute.** An action (`apps/web/lib/actions/<name>.ts`, built with
   `defineAction` from `apps/web/lib/actions/define-action.ts`) is one Zod-validated mutation
   reachable from a Server Action, an HTTP handler, or an accepted agent proposal — all three
   funnel through the same `execute(rawArgs, ctx)`, so no transport can bypass the schema.

```
facts (span-grounded)         ─┐
citations ledger (CitationRef) ┼─► agents (read-only) ─► Proposal (createProposal)
                                │        apps/web/lib/agents/agents/<name>.ts
                                │
                                ▼
                     orchestrator.ts: gateProposal → emitProposal
                                │
                                ▼
                     Inbox (tasks, state = Triage)
                                │  lawyer accepts
                                ▼
                     actions/<name>.ts: execute(args, ctx)  ← the only mutation
```

## How to add a new agent

1. Create `apps/web/lib/agents/agents/<name>.ts`. Call `defineAgent` from
   `apps/web/lib/agents/define-agent.ts` with an `input`/`output` Zod schema pair, a
   `trigger` (`"ambient" | "on_demand" | "sidebar"`), and a `run(input, ctx)` body that
   returns `{ output, proposals }`. Mint every proposal via `createProposal`
   (`apps/web/lib/agents/proposal.ts`) with ≥1 `CitationRef` — an uncited proposal is
   dropped by the render gate regardless.
2. Register it: import it into `apps/web/lib/agents/registry.ts` and add one line to the
   `agents` const map (key = the agent's own `name`). `AgentName` and every `route()` /
   `ask()` / `runAmbient()` call site pick it up automatically — no other file changes.
3. If `trigger: "ambient"`, list the event(s) it subscribes to via `on: [...]`
   (`"ecourts.synced" | "document.uploaded" | "task.completed"`); `runAmbient()` will
   dispatch to it on the next matching event.
4. If `trigger: "sidebar"`, set `routes: [...]` (path prefixes, e.g. `"/matters"`) so
   `route()` offers it on matching pages.

## How to add a new action

1. Create `apps/web/lib/actions/<name>.ts`. Call `defineAction` from
   `apps/web/lib/actions/define-action.ts` with a dot-namespaced `name` (e.g.
   `"task.create"`), a Zod `input` schema, and `run(args, ctx)` — `ctx.supabase` is the
   request-scoped, RLS-bound client; `ctx.source` tells you which transport is calling.
2. `register()` it (from `apps/web/lib/actions/define-action.ts`) so proposal acceptance and
   HTTP routing can look it up by name; keep a direct reference wherever a call site already
   has one in scope (fully typed, no lookup needed).
3. Expose it to a Server Action with a thin `"use server"` wrapper — `buildActionContext(...)`
   + `execute(rawArgs, ctx)` — mirroring the pattern in `apps/web/app/(app)/tasks/actions.ts`.
4. To let agents propose it, reference its dot-namespaced name as `Proposal.action` and shape
   `Proposal.args` to match its `input` schema — acceptance re-validates against that schema,
   so a stale or drifted envelope can never reach `run()` unvalidated.
