---
name: Multi-surface agentic assistant
last_updated: 2026-07-05
---

# Multi-Surface Agentic Assistant — Design

**One-line thesis:** the assistant is not a chatbot with plugins; it is a *turn function* over the case record whose outputs are typed blocks (text-with-claims, proposals, citations), and every surface — sidebar, MCP, HTTP, WhatsApp — is a renderer + identity-prover around that function. Approval is a database state transition (the Triage task), not a UI gesture, which is what makes "approve from anywhere" free.

---

## 1. Architecture — the Assistant Core and its seams

### What already exists (and is load-bearing)

The repo has quietly pre-built four of the six seams:

- **Action seam** — `lib/actions/define-action.ts` already declares `ActionSource = "server-action" | "http" | "agent-proposal"` and ships `asTool()` and `asHttpHandler()`. The HTTP and tool surfaces are half-designed.
- **Agent seam** — `orchestrator.ask/route/runAmbient` + the render gate (`gateProposals`: no citation → dropped before anything renders or persists).
- **Proposal seam** — `emitProposal` parks the envelope verbatim in a Triage-state `tasks` row, idempotent on `dedupe_key`. The Inbox *is* the approval queue.
- **Claim seam** — `messages.metadata.claims` (`claim_id, part, start, end`) already maps text ranges in message parts to `citations` ledger rows, and the ledger stores `quote` — which turns out to be the key to text-only surfaces (§4b).

### What the core adds: `lib/assistant/`

```
lib/assistant/
  core.ts        runTurn(conversationId, inbound, principal) → AssistantTurn
  turn.ts        AssistantTurn = ordered blocks (zod):
                   { kind:'text', text, claims: MessageClaim[] }
                 | { kind:'proposal', proposal, task_id, short_ref }
                 | { kind:'withheld', count }          // uncited claims dropped
                 | { kind:'refs', citations: Citation[] }
  context.ts     SurfaceContext (generalizes RouteContext) + context assembler
  principal.ts   resolvePrincipal(surface, creds) → { lawyer_id, supabase, tier }
  render/
    web.ts       AssistantTurn → UIMessage parts (AI SDK stream)
    chat.tsx     AssistantTurn → Chat SDK JSX Card / plain text + footnotes
    json.ts      AssistantTurn → HTTP/MCP structured content
  chat-bot.ts    the one Chat SDK `Chat` instance (adapters + state-pg)
```

**`runTurn` owns:** persist the user message → assemble context (matter binding, recent activity, facts, tasks — via the same `lib/db.ts` reads, under RLS) → decide: direct grounded answer, `ask(agentName, …)`, or a typed-action tool call rendered as a proposal via `emitProposal` → extract claims and write `citations` rows → **apply the render gate to text too** (assertion sentences with no claim get dropped and counted in a `withheld` block) → persist the assistant message (`parts` + `metadata.claims`) → return the `AssistantTurn`.

The core never mutates domain tables. Its only writes are `conversations`/`messages`/`citations` plus `emitProposal` — the same invariant `define-agent.ts` already enforces for agents.

### Composition diagram

```
                    ┌─────────────────────────────────────────────┐
   SURFACES         │              ASSISTANT CORE                 │      SUBSTRATE
                    │                                             │
 Sidebar (useChat)──►  render/web ─┐                              │
 WhatsApp ─┐        │              │   runTurn()                  │   conversations
 Telegram ─┼─Chat SDK► render/chat ├─►  ├─ context assembler ─────┼─► + messages (claims)
 Slack ────┘  bot   │              │    ├─ orchestrator.ask ──────┼─► agents registry
 MCP tools ─────────►  render/json ┘    ├─ actions.asTool ────────┼─► typed actions
 HTTP /v1 ──────────►                   ├─ claim extractor ───────┼─► citations ledger
                    │                   └─ emitProposal ══════════┼─► tasks (Triage)
                    │  resolvePrincipal (identity seam)           │        ║
                    └─────────────────────────────────────────────┘        ║
                          approve/dismiss/snooze — from ANY surface ═══════╝
                          (inbox accept action = the one state transition)
```

**The six named seams:** (1) Action (`execute`, 3 transports), (2) Agent (`ask`/`runAmbient` + gate), (3) Proposal (`emitProposal` → Triage task), (4) **Turn** (`runTurn` → `AssistantTurn`, new), (5) **Render** (per-surface, new), (6) **Principal** (identity → RLS-bound Supabase client, new). Chat SDK state uses `@chat-adapter/state-pg` pointed at the same Supabase Postgres (separate schema), so locks/dedupe/subscriptions live beside the data.

**Rule that keeps surfaces cheap:** every surface must prove *who* (principal seam) and *where* (SurfaceContext); everything else is shared. RLS is the floor on all of them — no surface ever runs core reads on a service-role client.

---

## 2. The in-app sidebar

**Placement.** A collapsible right panel mounted in `app/(app)/layout.tsx` (a `Panel`-derived shell, not hand-rolled), summonable via the existing cmdk palette and `Cmd+.`. Content streams through `app/api/assistant/route.ts` (AI SDK `useChat`, UIMessage parts) — the web renderer of the same `runTurn`. *(Reconcile with the single-column layout decision: see `docs/design/product-ux-mental-model.md` — a summonable overlay drawer, not a resident pane.)*

**Context-awareness = the scope chip.** The panel header shows a pinned, *visible* scope derived from the route (the existing `RouteContext`): on `/matters/[id]` it shows the matter title + CNR in Geist Mono; on a task it shows the task and its matter. This is the CNR isolation boundary made tangible — the lawyer sees exactly what the assistant can read, and can clear it to portfolio scope (calendar/tasks reads only; document/fact grounding always stays single-matter, matching the DB-level span isolation in the grounding migration). `orchestrator.route(ctx)` picks which sidebar specialists surface as suggestion chips.

**Proposals inline.** A `ProposalCard` block (shared with the Inbox card, not a second component): title from `summarizeProposal`, `trace` as the visible "why", citation chips, and Approve / Dismiss / Snooze buttons calling the *existing* inbox accept/dismiss/snooze actions via `useTransition`. The card is a live view of the Triage task — if the lawyer approves it from the Inbox (or WhatsApp) instead, the card flips to "Accepted → view TASK-key". Proposals never stream partially; text streams, proposal blocks arrive whole as typed data parts after gating.

**Citations click-to-source.** Superscript markers bound by `metadata.claims` offsets. Click → popover showing `citations.quote` + source label → "open": a record-ref navigates to the activity row/task/matter; a span-ref opens the document viewer scrolled to `start_offset` with the range highlighted. Sentences the claim extractor couldn't ground don't render — the turn ends with a quiet footer: *"1 statement withheld — no source in the case file."* That footer is a feature, not an apology; it is the product's trust signature.

**Persistence.** Default thread = one `conversations` row per (lawyer, matter, kind='assistant'), plus a thread switcher for new threads. Because history is in `conversations`/`messages` and not component state, the same thread continues on WhatsApp later — that's the substrate paying off.

---

## 3. Multi-surface exposure

### MCP server (`app/api/mcp/[transport]`)

- **Read tools** (execute immediately, RLS-bound): `list_matters`, `get_matter(id|cnr)`, `get_case_timeline(matter_id)`, `list_tasks(filter)`, `list_hearings(range)`, `read_document_span(document_id, start, end)`, `search_case_record(matter_id, query)`.
- **Write tools = propose-only.** Every mutating tool is the action registry via `asTool()`, but its handler calls `emitProposal`, never `execute`. Return shape: `{ proposal_short_ref, task_id, approval_url, status:'pending_approval' }`. An external model literally cannot mutate the case file — it can only file paperwork for the lawyer to sign. This is the approve-before-act invariant surviving contact with someone else's agent.
- **Agent tool:** `ask_specialist(agent_name, input)` → gated `AgentResult` as structured content.
- **Resources:** `matter://{id}/timeline`, `document://{id}#L{start}-{end}` — citation refs in tool results carry these URIs so an MCP client (e.g. Claude) can dereference evidence itself.
- **Turn mapping:** pure tool calls don't create conversation rows; a `converse` tool binds the MCP session to a `conversations` row (`metadata.channel:'mcp'`) when continuity is wanted.
- **Auth:** PAT (hashed, in a new `api_tokens` table: `lawyer_id, scopes, matter_ids nullable`) exchanged per-request for a lawyer-scoped Supabase JWT so RLS applies. `matter_ids` on the token = CNR isolation you can hand to a third-party agent ("this token sees only these two matters").

### HTTP API (`/api/v1`)

- `/api/v1/actions/{name}` — mount `asHttpHandler()` (already built). Default: mutating actions return **202 + proposal ref**, not 200 + mutation; a token needs an explicit `execute:` scope per action to bypass proposal mode (for the lawyer's own trusted scripts).
- `/api/v1/assistant/turns` — POST message (+ conversation_id) → SSE stream of `AssistantTurn` blocks as JSON. **This endpoint is also what the Chat SDK handler calls internally** — one code path, guaranteed parity between "public API" and "our own WhatsApp bot".
- Outbound webhooks: `proposal.created`, `proposal.resolved`, `hearing.synced`.

### External chat — one Chat SDK bot, three adapters

`lib/assistant/chat-bot.ts`: one `Chat` instance with `@chat-adapter/whatsapp` (WhatsApp Business Cloud — an official adapter exists), `@chat-adapter/telegram`, `@chat-adapter/slack`; state via `@chat-adapter/state-pg`. Webhooks at `app/api/chat/[adapter]/route.ts` → `bot.webhooks.<name>`.

- **Turn mapping:** Chat SDK thread ↔ `conversations` row via a new `conversation_channels` table (`conversation_id, provider, external_thread_id`, unique per provider-thread). `onDirectMessage`/`onSubscribedMessage` → resolvePrincipal (§4d) → append user message → `runTurn` → `render/chat` → `thread.post()`. The canonical assistant message is the `messages` row; delivery receipts go in `metadata.delivery`. Streaming uses Chat SDK's post+edit fallback (`streamingUpdateIntervalMs`) — fine for Telegram/Slack; on WhatsApp post the final text only (edit cadence is poor there).
- **Surface constraints, concretely:** WhatsApp — max 3 reply buttons, no modals, and the **24-hour session window**: business-initiated pushes outside a live session require pre-approved template messages. Register three templates up front: `daily_cause_list`, `hearing_reminder`, `proposal_pending`. Telegram — inline keyboards, no window restriction, ideal testbed. Slack — full cards/modals/assistant threads; lowest priority for this ICP (solo Indian litigators are not in Slack).

---

## 4. The hard problems

### (a) Approve-before-act on a text-only surface

The insight that makes this tractable: **approval is already a row-state transition** (Triage task → accept), so a text surface only needs (i) a way to *name* the proposal and (ii) proof of *who* is approving.

- **Short refs.** Mint `attributes.proposal.short_ref` ("P-42", per-lawyer counter) at `emitProposal` — UUIDs are unusable in text. WhatsApp rendering:
  > **[P-42] Create deadline — File written statement by 14-Aug-2026.**
  > Why: order dt 15-Jul-2026 served 18-Jul; 30 days under O.VIII R.1.
  > Sources: (1) Order 15-Jul, p.3: "defendants are directed to file…" (2) eCourts entry 03-Jul.
  > Buttons: **Approve** / **Skip** / **Open** — or reply "approve 42".
- **Risk tiers per action.** `read` (no approval) · `internal-write` (task/label/remark — approvable via chat button or "approve 42") · `outbound/irreversible` (client email via Resend, anything filing-adjacent) — chat approval is **not** sufficient: the bot replies with a short-lived signed magic link opening the proposal in the app for authenticated one-tap confirm. Tier assignment lives on the action definition; a settings toggle lets a lawyer promote internal-writes to link-only if they're paranoid.
- **Safety semantics.** `onAction` handlers verify the actor's channel identity is verified and fresh (§4d) before executing the accept action with `source:'agent-proposal'`. Idempotent by construction (`dedupe_key` + state check): "approve 42" on an already-accepted proposal returns "Already done at 14:02, TASK-118." Approvals expire with the existing `snoozed_until` machinery; approving stale proposals re-renders the current state first ("the hearing date changed since this was proposed — review again").

### (b) Citations without rich UI

The ledger's `quote` column is the whole answer. Degradation ladder:

1. Superscripts become bracketed numbers `[1]` inline.
2. A `Sources:` footer lists each citation as **quote + human label + short link**: the actual operative sentence from the order travels *in the message*, so the citation is verifiable on a phone screen without clicking anything.
3. Each footnote's link is `legal.owl/c/{claim_id}` — a resolver route that authenticates and lands on the record row or the document viewer with the span highlighted (same target the sidebar popover uses).
4. The render gate is unchanged and identical across surfaces — it lives in `runTurn`, upstream of every renderer. Withheld-claim counts render as the same one-line footer.

A generic wrapper can't do step 2 — it has no span-anchored quote store.

### (c) Auth + CNR isolation per surface

One principle: **RLS is the enforcement floor everywhere; surfaces differ only in how they prove identity.**

| Surface | Proof | Supabase client |
|---|---|---|
| Sidebar | cookie session (existing) | existing `lib/supabase/server` |
| HTTP / MCP | PAT → per-request lawyer-scoped JWT | RLS applies as that lawyer |
| WhatsApp/Telegram/Slack | `channel_identities` row (verified pairing) → same JWT mint | RLS applies as that lawyer |

CNR isolation layers on top: a conversation carries at most one matter binding; the context assembler refuses cross-matter joins within a scoped turn (grounding/facts/documents are single-matter always — matching the DB-level span isolation already in `20260705000001_agent_grounding_layer.sql`); portfolio-scope turns get only the calendar/task read class. PATs can additionally pin `matter_ids`. An unrecognized WhatsApp number gets a fixed refusal + pairing link — never a lookup, never an answer.

### (d) Identity mapping (external user → lawyer)

- **Pairing is in-app only, outbound-initiated.** Settings → Channels → "Link WhatsApp" shows a `wa.me` deep link / QR pre-filled with a one-time nonce; the lawyer sends it from their phone; the webhook binds `(provider, external_user_id) → lawyer_id` into `channel_identities` (`verified_at`, unique per provider — one number, one lawyer; shared staff numbers are explicitly out of scope, consistent with the solo-lawyer ICP). A phone number claiming to be someone is never identity; only the nonce round-trip is.
- **Step-up:** approval-tier actions require `verified_at` fresher than N days, else the bot falls back to magic-link approval. Unlink instantly kills the channel.
- **Clients are a different species, not a different tier:** client phone numbers map to `clients` and `conversations.kind='client'` — a separate conversation kind with a read-only, no-proposals, client-safe playbook. The schema already anticipated this split; never let the two kinds share a renderer default.

---

## 5. Phased rollout

**Phase 1 — Sidebar (now).** Building it forces exactly the seams that make everything else cheap: `runTurn`, `AssistantTurn`, claim extraction writing the ledger, `render/web`, proposal cards reusing the Inbox accept flow. Ship with the existing agents as suggestion chips plus grounded Q&A over the case record.

**Phase 2a — Telegram (the rehearsal, ~days not weeks).** Same Chat SDK bot, no template-window bureaucracy, first-class buttons. It exists to harden `render/chat`, footnote citations, `short_ref` approvals, and `channel_identities` with near-zero platform friction.

**Phase 2b — WhatsApp (the prize).** For a solo Indian litigator, WhatsApp *is* the office — this is the surface that changes daily behavior. Everything from 2a carries over via the Chat SDK's normalization; the WhatsApp-specific work is only: Business Cloud onboarding, the three message templates, the 24h-window send logic, and the 3-button constraint.

**Phase 3 — MCP.** Cheap (actions already have `asTool()`; write tools just reroute to `emitProposal`) and strategically timed: by now the proposal queue is proven, so exposing propose-only tools to Claude and other agents is safe by construction.

**Phase 4 — HTTP `/v1` formalization + client-kind WhatsApp** (client update surface, separate playbook — the Client Experience track).

**The minimum shared core that makes surface #2 cheap:** `runTurn` + `AssistantTurn` + a text renderer (footnote citations + short_ref proposals) + `channel_identities` + the already-built `emitProposal`/Inbox accept. That's it — everything else in Phase 2 is platform plumbing.

**New schema, total:** `channel_identities`, `conversation_channels`, `api_tokens`, plus `attributes.proposal.short_ref`. Four small additions; the heavy tables already exist.

---

## 6. Non-obvious moves (only possible with this substrate)

1. **The 8:30 IST cause-list brief as a WhatsApp template push.** Ambient, from live eCourts sync (`lib/ecourts/sync.ts` → `ecourts.synced` fan-out): "Today: 2 hearings — (1) CNR DLST…: arguments, Saket ct 4; (2) …; 1 overdue task." Every line is citation-backed (activity record-refs) and deep-linked; a reply in that thread is already contextual ("what happened last time in the second one?"). A generic wrapper has no synced case record to brief from. This is the retention loop: the product messages the lawyer before the lawyer opens the product.
2. **Approve-anywhere, one ledger.** Because a proposal is a Triage task, the Inbox is a *cross-surface* approval queue: parked from MCP at midnight, nudged via WhatsApp template at 8:30, approved from the phone, visible as accepted in the sidebar card. Generic bots' "confirm?" is session-ephemeral; here it's durable, deduped (`dedupe_key`), and auditable.
3. **Quotes as the citation payload.** Storing `citations.quote` means the text surface carries the evidence itself — the operative line of the order arrives inside the WhatsApp message. The trust property ("every claim traceable") survives the dumbest possible renderer, which is exactly where lawyers' skepticism of AI is highest.
4. **Forwarded-message intake (court-day mode).** A lawyer forwards a photo of a certified order or opposing counsel's message into the matter-bound WhatsApp thread → Chat SDK file ingestion → upload to `case-documents` → `document.uploaded` ambient event → `intake-registrar` extracts date-bearing facts → `limitation-clerk` proposes the deadline → the proposal returns *in the same thread* minutes later with the span-cited computation. The phone becomes the intake scanner; the corridor outside the courtroom becomes the workflow surface.
5. **CNR as an addressing scheme.** In any text surface, pasting a CNR both *finds* and *scopes*: "DLHC010012342024 — what's the next date?" binds the thread to that matter (isolation boundary = addressing primitive). CNRs are what Indian litigators already exchange; no other identifier needs teaching.

---

**Anti-genericness check, applied:** nothing above works without (a) the synced case record, (b) the citation ledger with quotes and spans, (c) the proposal-as-Triage-task queue, or (d) CNR-scoped isolation. Strip those and every feature collapses into "a chatbot" — which is the point: the moat is the substrate, and the surfaces are thin by design.
