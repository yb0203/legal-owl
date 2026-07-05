// The fact.create typed action — insert a verified, span-cited fact on a matter.
// This is what an approved Intake-Registrar proposal executes (approve-before-act):
// the agent proposes it into the Inbox; the lawyer's accept runs it here. Importing
// this module registers the action so proposal-acceptance can look it up by name.

import { z } from "zod";
import { defineAction, register } from "@/lib/actions/define-action";

const FactCreateInput = z.object({
  matter_id: z.uuid(),
  document_id: z.uuid(),
  fact_type: z.string().min(1),
  value_text: z.string().min(1),
  value: z.unknown().optional(),
  confidence: z.number().min(0).max(1).default(0.8),
  start_offset: z.number().int().nonnegative().default(0),
  end_offset: z.number().int().nonnegative().default(0),
  source_rank: z.number().int().optional(),
  extractor_version: z.string().default("intake-registrar@openrouter"),
});

export const createFactAction = defineAction({
  name: "fact.create",
  description:
    "Create a verified, span-cited fact on a matter from an approved intake proposal.",
  input: FactCreateInput,
  async run(args, ctx): Promise<{ id: string }> {
    const start = args.start_offset;
    // The facts table enforces end_offset > start_offset; clamp if the model gave a bad range.
    const end = args.end_offset > start ? args.end_offset : start + 1;
    const value = args.value ?? { kind: "text", text: args.value_text };

    const { data, error } = await ctx.supabase
      .from("facts")
      .insert({
        lawyer_id: ctx.user.id,
        matter_id: args.matter_id,
        document_id: args.document_id,
        start_offset: start,
        end_offset: end,
        fact_type: args.fact_type,
        value,
        value_text: args.value_text,
        confidence: args.confidence,
        status: "verified", // the lawyer approved the proposal — that IS verification
        verified_at: new Date().toISOString(),
        source_rank: args.source_rank ?? 100,
        extractor_version: args.extractor_version,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: data.id as string };
  },
});

register(createFactAction);
