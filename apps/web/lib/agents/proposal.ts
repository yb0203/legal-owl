// The Proposal Envelope — the ONLY channel through which an agent's work can
// reach the database. Agents never mutate directly (see ./define-agent.ts);
// a `run` body returns Proposals, a lawyer accepts one, and only then does
// the underlying action actually execute (lib/actions/*, owned by another
// agent).
//
// The envelope schema itself is owned by @/lib/schemas
// (lib/schemas/proposal.ts) — re-exported here verbatim, not redefined, per
// task instructions ("import the Citation/proposal pieces from @/lib/schemas
// ... do not redefine them"). This file adds the agent-platform-side
// plumbing around that schema: `createProposal` (the one way an agent mints
// a Proposal) and `proposalToTask` (park a Proposal in the Inbox/Triage
// state — lib/agents/orchestrator.ts#emitProposal, owned by another agent,
// imports and delegates to this).

import type { SupabaseClient } from "@supabase/supabase-js";
import { ProposalSchema } from "@/lib/schemas";
import type { Proposal, CitationRef } from "@/lib/schemas";
import { getSystemStateId } from "@/lib/db";

export { ProposalSchema };
export type { Proposal };

// ── Minting ───────────────────────────────────────────────────────────────

/** Deterministic key over (agent, action, canonical args) so re-running the
 *  same extraction/analysis never double-parks the same proposal. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(",")}}`;
}

function computeDedupeKey(
  agent: string,
  action: string,
  args: Record<string, unknown>,
): string {
  // A lightweight, dependency-free string hash (FNV-1a) — good enough for an
  // idempotency key, and keeps this module runtime-agnostic (no Node-only
  // `node:crypto` import).
  let hash = 0x811c9dc5;
  const input = `${agent}:${action}:${stableStringify(args)}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * The ONLY way agents mint proposals. Mints `id`/`created_at`/`dedupe_key`
 * and parses the result through `ProposalSchema`, so a malformed envelope
 * can never leave an agent's `run` body.
 *
 * `action` is a plain string here (not `z.enum(actionNames)`) because this
 * file must not import the action registry (lib/actions, owned by another
 * agent) — see the identical deviation note in lib/schemas/proposal.ts.
 * `args` is re-validated against the target action's own input schema at
 * accept time; this envelope only carries them, it does not trust them.
 */
export function createProposal(p: {
  agent: string;
  action: string;
  args: Record<string, unknown>;
  citations: CitationRef[];
  trace?: string;
  confidence: number;
}): Proposal {
  return ProposalSchema.parse({
    v: 1,
    id: crypto.randomUUID(),
    agent: p.agent,
    action: p.action,
    args: p.args,
    citations: p.citations,
    trace: p.trace,
    confidence: p.confidence,
    dedupe_key: computeDedupeKey(p.agent, p.action, p.args),
    created_at: new Date().toISOString(),
  });
}

// ── Proposal → Inbox ─────────────────────────────────────────────────────

/**
 * Persist a Proposal as an Inbox item: insert into `tasks` with
 * `type='task'`, `state_id=`getSystemStateId(supabase,'Triage')``,
 * `key=null` (minted only on accept), `source='agent'`, a short title
 * derived from agent+action, `description=proposal.trace ?? null`,
 * `matter_id` read off `proposal.args.matter_id` (every registry action
 * carries one), and the envelope verbatim in `attributes.proposal`.
 *
 * Idempotent: re-parks nothing if an open (state=Triage) task with a
 * matching `attributes.proposal.dedupe_key` already exists — returns that
 * task's id instead. Callers are expected to have already run the proposal
 * through the render gate (lib/agents/orchestrator.ts) before calling this.
 */
export async function proposalToTask(
  supabase: SupabaseClient,
  lawyerId: string,
  proposal: Proposal,
): Promise<string> {
  const triageStateId = await getSystemStateId(supabase, "Triage");
  if (!triageStateId) {
    throw new Error("System 'Triage' workflow state is not configured");
  }

  const { data: existing } = await supabase
    .from("tasks")
    .select("id")
    .eq("type", "task")
    .eq("state_id", triageStateId)
    .eq("attributes->proposal->>dedupe_key", proposal.dedupe_key)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const matterId = proposal.args.matter_id;
  if (typeof matterId !== "string" || matterId.length === 0) {
    throw new Error(
      `Proposal action "${proposal.action}" args must carry a matter_id`,
    );
  }

  const { data: inserted, error } = await supabase
    .from("tasks")
    .insert({
      lawyer_id: lawyerId,
      matter_id: matterId,
      type: "task",
      state_id: triageStateId,
      key: null,
      title: `Review: ${proposal.agent} proposes ${proposal.action}`,
      description: proposal.trace ?? null,
      source: "agent",
      attributes: { proposal },
    })
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error(error?.message ?? "Failed to park proposal in the Inbox");
  }
  return inserted.id as string;
}
