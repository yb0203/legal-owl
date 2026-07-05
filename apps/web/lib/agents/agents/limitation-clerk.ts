// Limitation Clerk — date-bearing facts to a deadline Proposal.
//
// Given one or more verified/proposed `facts` rows whose `value` is a `date`
// (order date, service date, filing date, ...), computes the applicable
// limitation period and proposes a `task.create` (type='deadline') Proposal
// — never creates the deadline task itself. `trace` carries the human-
// readable "why" (which fact, which limitation rule/article, the resulting
// due date) shown on the Inbox card so a lawyer can verify the reasoning
// before accepting.
//
// Trigger: "on_demand" rather than "ambient" — none of the three fixed
// ambient events (ecourts.synced | document.uploaded | task.completed)
// represents "a date-bearing fact was extracted"; this agent is invoked
// explicitly (e.g. right after an Intake Registrar proposal is accepted).

import { z } from "zod";
import {
  defineAgent,
  type AgentResult,
} from "@/lib/agents/define-agent";
import { ProposalSchema, type Proposal } from "@/lib/agents/proposal";

/** The slice of a `facts` row this agent needs — a date-typed fact with its
 *  span provenance, not the full facts table shape. */
export const DateBearingFactSchema = z.object({
  fact_id: z.uuid(),
  document_id: z.uuid(),
  /** Open vocabulary, mirrors `facts.fact_type` (e.g. "order_date",
   *  "service_date", "filing_date"). */
  fact_type: z.string().min(1),
  /** ISO yyyy-mm-dd — mirrors the `date` variant of `FactValue`. */
  date: z.iso.date(),
  start_offset: z.number().int().nonnegative(),
  end_offset: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
});
export type DateBearingFact = z.infer<typeof DateBearingFactSchema>;

export const LimitationClerkInputSchema = z.object({
  matter_id: z.uuid(),
  forum_type: z
    .enum([
      "district",
      "high_court",
      "supreme_court",
      "nclt",
      "nclat",
      "arbitration",
      "tribunal",
      "other",
    ])
    .optional(),
  facts: z.array(DateBearingFactSchema).min(1),
});
export type LimitationClerkInput = z.infer<typeof LimitationClerkInputSchema>;

/** Output = the Proposal schema verbatim: a single `task.create`
 *  (type='deadline') proposal, with `trace` explaining the computed
 *  limitation period from the cited date-bearing fact(s). */
export const limitationClerkAgent = defineAgent({
  name: "limitation-clerk",
  description:
    "Given date-bearing facts (order date, service date, filing date, ...), computes the applicable limitation period and proposes a deadline task with a trace explaining the computation. Never creates the deadline task directly.",
  input: LimitationClerkInputSchema,
  output: ProposalSchema,
  trigger: "on_demand",
  async run(
    _input: LimitationClerkInput,
  ): Promise<AgentResult<Proposal>> {
    throw new Error("not implemented yet");
  },
});
