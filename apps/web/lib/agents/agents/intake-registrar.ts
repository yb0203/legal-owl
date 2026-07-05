// Intake Registrar — uploaded documents to span-cited facts.
//
// Fires ambiently on `document.uploaded`: reads the newly uploaded
// document's extracted text and proposes `facts` rows (party names, filing
// dates, claim amounts, relief sought, ...), each grounded in a char-offset
// span into that document. It never writes a `facts` row itself — it mints
// a `fact.create` Proposal per candidate fact, which a lawyer reviews and
// accepts (or the Inbox auto-parks per the usual Triage flow).

import { z } from "zod";
import {
  defineAgent,
  type AgentResult,
} from "@/lib/agents/define-agent";
import { ProposalSchema, type Proposal } from "@/lib/agents/proposal";

export const IntakeRegistrarInputSchema = z.object({
  matter_id: z.uuid(),
  document_id: z.uuid(),
});
export type IntakeRegistrarInput = z.infer<typeof IntakeRegistrarInputSchema>;

/** Output = the Proposal schema verbatim: this agent's entire deliverable
 *  per invocation is a single `fact.create` proposal (the orchestrator may
 *  invoke it once per candidate fact, or a future run body may return the
 *  first/highest-confidence proposal as `output` while `proposals` carries
 *  the full batch). */
export const intakeRegistrarAgent = defineAgent({
  name: "intake-registrar",
  description:
    "Reads a newly uploaded document's extracted text and proposes span-cited facts (party names, filing dates, claim amounts, relief sought, ...) for lawyer review. Never writes a facts row directly.",
  input: IntakeRegistrarInputSchema,
  output: ProposalSchema,
  trigger: "ambient",
  on: ["document.uploaded"],
  async run(
    _input: IntakeRegistrarInput,
  ): Promise<AgentResult<Proposal>> {
    throw new Error("not implemented yet");
  },
});
