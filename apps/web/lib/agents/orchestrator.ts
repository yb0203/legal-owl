// Orchestration: sidebar routing, ambient event fan-out, Proposal → Inbox
// mapping, and the render-gate chokepoint every outbound Proposal must pass
// through before it leaves this module.
//
// Invariant: agents never mutate (see lib/agents/define-agent.ts) — the only
// DB write on any path here is emitProposal, a Triage-state `tasks` insert.
// Executing the underlying action only happens later, via a caller-owned
// accept flow (mirroring app/(app)/inbox/actions.ts's accept/dismiss/snooze),
// after explicit user approval. Nothing in this file calls lib/actions/*.

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSystemStateId } from "@/lib/db";
import type { AgentContext, AgentResult, AnyAgent } from "@/lib/agents/define-agent";
import { ProposalSchema, type Proposal } from "@/lib/agents/proposal";
import type { CitationRef } from "@/lib/schemas";
import { getAgent, listAgents, listAgentsByTrigger, type AgentName } from "@/lib/agents/registry";

// ── Sidebar routing ──────────────────────────────────────────────────────────

export const RouteContextSchema = z.object({
  route: z.string(),
  matter_id: z.uuid().optional(),
  task_id: z.uuid().optional(),
  selection: z.string().optional(),
});
export type RouteContext = z.infer<typeof RouteContextSchema>;

/**
 * Sidebar picker: trigger==='sidebar' agents whose `routes` prefix-match
 * ctx.route, in registry order. Pure lookup — safe to call from a Server
 * Component to decide which specialists to offer for the current page; it
 * does not run anything (see `ask` for that).
 */
export function route(ctx: RouteContext): AnyAgent[] {
  const parsed = RouteContextSchema.parse(ctx);
  return listAgentsByTrigger("sidebar").filter((agent) =>
    (agent.routes ?? []).some((prefix) => parsed.route.startsWith(prefix)),
  );
}

/**
 * Sidebar / on-demand entry point: run one specialist by name against a
 * RouteContext-derived (or otherwise caller-assembled) input. Returns the
 * gated AgentResult — every proposal has already passed the render gate, so
 * callers never see an uncited one. Does NOT park proposals in the Inbox
 * (see `emitProposal` / `runAmbient` for that) — a sidebar caller decides
 * separately whether/when to file one.
 */
export async function ask(
  agentName: AgentName,
  rawInput: unknown,
  ctx: AgentContext,
): Promise<AgentResult<unknown>> {
  const agent = getAgent(agentName);
  const result = await agent.invoke(rawInput, ctx);
  return { output: result.output, proposals: gateProposals(result.proposals) };
}

// ── Ambient event fan-out ────────────────────────────────────────────────────

export const AmbientEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ecourts.synced"),
    matter_id: z.uuid(),
    activity_ids: z.array(z.uuid()),
    changes: z
      .array(
        z.object({
          event_type: z.string(),
          previous_value: z.string().nullable().optional(),
          new_value: z.string().nullable().optional(),
          occurred_at: z.string().optional(),
        }),
      )
      .optional(),
  }),
  z.object({
    type: z.literal("document.uploaded"),
    matter_id: z.uuid(),
    document_id: z.uuid(),
  }),
  z.object({
    type: z.literal("task.completed"),
    matter_id: z.uuid(),
    task_id: z.uuid(),
  }),
]);
export type AmbientEvent = z.infer<typeof AmbientEventSchema>;
export type AmbientEventType = AmbientEvent["type"];

/**
 * Event fan-out: parse event → for each trigger==='ambient' agent subscribed
 * to event.type (agent.on) → agent.invoke(event, ctx) → gate + emit each
 * resulting proposal into the Inbox. Per-agent failures are isolated — one
 * agent throwing never blocks the rest, and never blocks the caller (e.g.
 * lib/ecourts/sync.ts, the one sync coupling point, plus upload actions and
 * task-complete actions).
 */
export async function runAmbient(
  event: AmbientEvent,
  ctx: AgentContext,
): Promise<{ agent: AgentName; taskIds: string[] }[]> {
  const parsedEvent = AmbientEventSchema.parse(event);
  const results: { agent: AgentName; taskIds: string[] }[] = [];

  for (const agent of listAgents()) {
    if (agent.trigger !== "ambient" || !agent.on?.includes(parsedEvent.type)) continue;

    const name = agent.name;
    const taskIds: string[] = [];
    try {
      const result = await agent.invoke(parsedEvent, ctx);
      for (const proposal of gateProposals(result.proposals)) {
        const taskId = await emitProposal(ctx.supabase, ctx.user.id, proposal);
        if (taskId) taskIds.push(taskId);
      }
    } catch (err) {
      // Isolate per-agent failures — never let one specialist block the fan-out.
      console.error(`[runAmbient] agent "${name}" failed on "${parsedEvent.type}":`, err);
    }
    results.push({ agent: name, taskIds });
  }

  return results;
}

// ── Proposal → Inbox ─────────────────────────────────────────────────────────

/**
 * Gate a Proposal, then map it to a Triage-state task — the Inbox already IS
 * tasks parked in the system Triage state, so proposals reuse it wholesale:
 * type='task', key=null (minted only on accept, mirroring
 * app/(app)/inbox/actions.ts#acceptTriageItem), state_id=Triage,
 * source='agent', the envelope verbatim in attributes.proposal. Idempotent on
 * attributes.proposal.dedupe_key — a second call for the same proposal
 * returns the existing task's id rather than inserting a duplicate.
 *
 * This is the orchestrator-facing chokepoint every dispatch path
 * (ask/runAmbient) — and any future manual "file this" caller — funnels
 * through. Returns null (no DB write attempted, or the write failed) rather
 * than throwing: the proposal fails the render gate, it carries no
 * `matter_id` in its args (every registry action is documented to carry
 * one — Agent Platform Contracts §4), the Triage state isn't configured for
 * this lawyer, or the insert itself errored — none of which should take
 * down a batch (see runAmbient's per-agent isolation).
 */
export async function emitProposal(
  supabase: SupabaseClient,
  lawyerId: string,
  proposal: Proposal,
): Promise<string | null> {
  const gated = gateProposal(ProposalSchema.parse(proposal));
  if (!gated) return null;

  const matterId = matterIdFromProposal(gated);
  if (!matterId) return null;

  const triageStateId = await getSystemStateId(supabase, "Triage");
  if (!triageStateId) return null;

  const { data: existing } = await supabase
    .from("tasks")
    .select("id")
    .eq("type", "task")
    .eq("state_id", triageStateId)
    .eq("attributes->proposal->>dedupe_key", gated.dedupe_key)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: inserted, error } = await supabase
    .from("tasks")
    .insert({
      lawyer_id: lawyerId,
      matter_id: matterId,
      type: "task",
      key: null,
      title: summarizeProposal(gated),
      description: gated.trace ?? null,
      state_id: triageStateId,
      source: "agent",
      attributes: { proposal: gated },
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error(`[emitProposal] failed to park proposal "${gated.id}":`, error);
    return null;
  }
  return inserted.id as string;
}

function matterIdFromProposal(proposal: Proposal): string | null {
  const matterId = proposal.args["matter_id"];
  return typeof matterId === "string" && matterId.length > 0 ? matterId : null;
}

/** Short imperative Inbox-card title: `trace`'s first line if present, else "<agent>: <action>". */
function summarizeProposal(proposal: Proposal): string {
  const firstLine = proposal.trace?.trim().split("\n")[0];
  return firstLine ? firstLine.slice(0, 140) : `${proposal.agent}: ${proposal.action}`;
}

// ── Render gate ──────────────────────────────────────────────────────────────

/**
 * Render-gate predicate: does this item carry at least one CitationRef? The
 * "no citation, no render, no action" invariant lives here and nowhere else —
 * route()/ask()/runAmbient()/emitProposal() all funnel every proposal through
 * gateProposal/gateProposals before it can be rendered or persisted.
 */
export function hasCitations(item: { citations: CitationRef[] }): boolean {
  return item.citations.length > 0;
}

/** Drops the proposal if it carries zero citations. */
export function gateProposal(proposal: Proposal): Proposal | null {
  return hasCitations(proposal) ? proposal : null;
}

/** Drops every proposal in the array that carries zero citations. */
export function gateProposals(proposals: Proposal[]): Proposal[] {
  return proposals.filter(hasCitations);
}
