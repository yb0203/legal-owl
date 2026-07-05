// The Proposal Envelope — agents never mutate; they mint Proposals, which are
// persisted verbatim into `tasks.attributes` (Inbox/Triage) until a lawyer
// accepts them (Agent Platform Contracts §3).
//
// Deviation from the locked contract (documented per task instructions): the
// contract's `action` field is typed against the action registry
// (`z.enum(Object.keys(actions) as [ActionName, ...])`, from the not-yet-built
// lib/actions/registry.ts). This schema layer must not import or wire that
// registry, so `action` is modeled as an open, non-empty string here; the
// registry-aware `z.enum` narrowing belongs in lib/actions/registry.ts /
// lib/agents/proposal.ts when those are built, re-validating against this
// same shape.
//
// `citations` reuses citation.ts's CitationRefSchema (record-ref | span-ref)
// as the single source of truth, rather than redefining a divergent shape.

import { z } from "zod";
import { ConfidenceSchema } from "./provenance";
import { CitationRefSchema } from "./citation";

export const ProposalSchema = z.object({
  // Version tag for the envelope stored in tasks.attributes — enables migration later.
  v: z.literal(1),
  id: z.uuid(),
  // Agent registry name, e.g. "hearing-prep".
  agent: z.string().min(1),
  // Action registry name, e.g. "task.create". See deviation note above.
  action: z.string().min(1),
  // Re-validated against the target action's input schema at acceptance time.
  args: z.record(z.string(), z.unknown()),
  // Approve-before-act requires evidence.
  citations: z.array(CitationRefSchema).min(1),
  // Human-readable "why" shown in the Inbox card.
  trace: z.string().max(2000).optional(),
  confidence: ConfidenceSchema,
  // Stable hash of (agent, action, canonical args) — idempotency across re-runs.
  dedupe_key: z.string().min(1),
  created_at: z.iso.datetime(),
});
export type Proposal = z.infer<typeof ProposalSchema>;
